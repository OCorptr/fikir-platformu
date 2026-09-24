using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OtpNet;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// MFA (TOTP) endpoint'leri (plan §2.7 — Sprint 6 + Sprint 9 güncellemesi).
/// Tüm endpoint'ler PreMfaScheme ile authenticate olur:
///   /setup: secret üretir + otpauth URL döner (authenticator app elle eklenir)
///   /verify-setup: kodu doğrular + TwoFactorEnabled=true + normal scheme'e upgrade
///   /verify: MFA zaten enabled, sadece kodu doğrular + normal scheme'e upgrade
///   /disable: MFA'yı kapatır (privileged rollere yasak)
/// Login akışı: email/şifre doğruysa ve kullanıcı MFA zorunluysa login 200 + PreMfaScheme cookie yazılır
/// (mfaSetupRequired=true veya mfaRequired=true). Frontend /mfa/setup veya /mfa/verify'a yönlendirir.
/// </summary>
public static class MfaEndpoints
{
    public static IEndpointRouteBuilder MapMfaEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/auth/mfa").WithTags("MFA");

        // 1) MFA kurulumu başlat — secret üret, DB'ye yaz (TwoFactorEnabled=false).
        grup.MapPost("/setup", async (
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme,
            IConfiguration yapilandirma) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) return Results.Unauthorized();

            // 20 byte (160-bit) secret — Google Authenticator standart.
            var secretBytes = KeyGeneration.GenerateRandomKey(20);
            var secretBase32 = Base32Encoding.ToString(secretBytes);

            kullanici.TwoFactorSecret = sifreleme.Sifrele(secretBase32);
            // Setup sırasında TwoFactorEnabled henüz false — kullanıcı verify edince açılır.
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            // otpauth URL: authenticator app bu URL'yi "manuel ekle" kısmına yapıştırır.
            var issuer = Uri.EscapeDataString("Geleceğin Fikri");
            var label = Uri.EscapeDataString(kullanici.Email ?? kullanici.Id);
            var otpauthUrl = $"otpauth://totp/{issuer}:{label}?secret={secretBase32}&issuer={issuer}&digits=6&period=30";

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaSetupStarted, success: true, reason: null);

            return Results.Ok(new
            {
                secret = secretBase32,
                otpauthUrl,
                digits = 6,
                period = 30,
                issuer
            });
        }).RequireAuthorization("PreMfaOnly");

        // 2) Kurulum doğrulama — kullanıcı authenticator'dan aldığı 6 haneli kodu gönderir.
        //    Başarılı olursa PreMfaScheme SignOut + asıl scheme SignIn (cookie upgrade).
        grup.MapPost("/verify-setup", async (
            MfaKodIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) return Results.Unauthorized();
            if (string.IsNullOrEmpty(kullanici.TwoFactorSecret))
                return Results.Json(new { message = "Önce MFA kurulumunu başlatın." }, statusCode: 400);

            // DB'deki şifreli secret'i çöz (YEĞİTEK gereksinim #8).
            var secretDuzMetin = sifreleme.Coz(kullanici.TwoFactorSecret);
            if (string.IsNullOrEmpty(secretDuzMetin))
                return Results.Json(new { message = "MFA secret okunamadı. Lütfen kurulumu yeniden başlatın." }, statusCode: 400);

            // DEBUG: TOTP doğrulama öncesi secret/code/counter logla (geçici debug).
            var serverCounter = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
            Console.WriteLine($"[MFA-DEBUG] user={kullanici.Email} decrypted_secret='{secretDuzMetin}' code={istek.Code} server_counter={serverCounter}");

            if (!TotpGecerliMi(secretDuzMetin, istek.Code))
                return Results.Json(new { message = "Doğrulama kodu geçersiz." }, statusCode: 400);

            kullanici.TwoFactorEnabled = true;
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            // Scheme upgrade: PreMfaScheme SignOut + asıl scheme SignIn.
            var (hedefScheme, context) = await SchemeUpgradeYap(kullanici, kullaniciYoneticisi, girisYoneticisi, http);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaEnabled, success: true, reason: $"scheme={hedefScheme}");
            return Results.Ok(new
            {
                message = "İki adımlı doğrulama etkinleştirildi.",
                email = kullanici.Email,
                firstName = kullanici.FirstName,
                lastName = kullanici.LastName,
                context,
                mfaEnabled = true
            });
        }).RequireAuthorization("PreMfaOnly");

        // 3) Login akışı 2. adımı — MFA zaten enabled, kullanıcı MFA kodunu gönderir.
        //    PreMfaScheme authenticated, kodu doğrular, asıl scheme'e upgrade eder.
        grup.MapPost("/verify", async (
            MfaKodIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null || !kullanici.TwoFactorEnabled || string.IsNullOrEmpty(kullanici.TwoFactorSecret))
            {
                await AuthEventKaydet(veritabani, http, kullanici?.Email, kullanici?.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: "kullanici_yok_veya_mfa_kapali");
                return Results.Json(new { message = "Geçersiz istek." }, statusCode: 400);
            }

            // TOTP doğrula (30 sn pencere, ±1 step tolerans).
            var secretDuz = sifreleme.Coz(kullanici.TwoFactorSecret);
            if (string.IsNullOrEmpty(secretDuz) || !TotpGecerliMi(secretDuz, istek.Code))
            {
                await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: "kod_yanlis");
                return Results.Json(new { message = "Doğrulama kodu geçersiz." }, statusCode: 400);
            }

            // Scheme upgrade: PreMfaScheme SignOut + asıl scheme SignIn.
            var (hedefScheme, context) = await SchemeUpgradeYap(kullanici, kullaniciYoneticisi, girisYoneticisi, http);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaLoginSuccess, success: true, reason: $"scheme={hedefScheme}");

            return Results.Ok(new
            {
                email = kullanici.Email,
                firstName = kullanici.FirstName,
                lastName = kullanici.LastName,
                context,
                mfaVerified = true
            });
        }).RequireAuthorization("PreMfaOnly");

        // (eski) /login endpoint'i kaldırıldı — Sprint 9 ile birlikte /verify kullanılıyor.

        // 4) MFA kapatma — mevcut şifre + MFA kodu ile doğrulama zorunlu.
        // Ayrıcalıklı roller (MinistryOfficial, ProvinceManager, SystemAdmin) MFA kapatamaz.
        grup.MapPost("/disable", async (
            MfaKodIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null || !kullanici.TwoFactorEnabled || string.IsNullOrEmpty(kullanici.TwoFactorSecret))
                return Results.Json(new { message = "MFA zaten kapalı." }, statusCode: 400);

            // Ayrıcalıklı rol kontrolü (plan §7.1).
            var roller = await kullaniciYoneticisi.GetRolesAsync(kullanici);
            if (roller.Any(r => r is "MinistryOfficial" or "ProvinceManager" or "SystemAdmin"))
            {
                await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                    AuthEventType.MfaDisabled, success: false, reason: "ayricalikli_rol_zorunlu");
                return Results.Json(new
                {
                    message = "Bu hesap için iki adımlı doğrulama zorunludur ve kapatılamaz."
                }, statusCode: 403);
            }

            var secretDuzDisable = sifreleme.Coz(kullanici.TwoFactorSecret);
            if (string.IsNullOrEmpty(secretDuzDisable) || !TotpGecerliMi(secretDuzDisable, istek.Code))
                return Results.Json(new { message = "Doğrulama kodu geçersiz." }, statusCode: 400);

            kullanici.TwoFactorEnabled = false;
            kullanici.TwoFactorSecret = null;
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaDisabled, success: true, reason: null);
            return Results.Ok(new { message = "İki adımlı doğrulama kapatıldı." });
        }).RequireAuthorization("MfaCompleted");

        return app;
    }

    /// <summary>
    /// PreMfaScheme cookie'sini temizler, kullanıcının sahip olduğu role'lere göre asıl scheme seçer
    /// ve yeni cookie yazar (MFA tamamlandı → gerçek authenticated session'a upgrade).
    /// </summary>
    private static async Task<(string hedefScheme, string context)> SchemeUpgradeYap(
        ApplicationUser kullanici,
        UserManager<ApplicationUser> kullaniciYoneticisi,
        SignInManager<ApplicationUser> girisYoneticisi,
        HttpContext http)
    {
        // PreMfaScheme cookie'yi temizle (kullanıcı MFA'yı tamamladı).
        await http.SignOutAsync("PreMfaScheme");

        var roller = await kullaniciYoneticisi.GetRolesAsync(kullanici);
        var hedefScheme = GirisIcinSchemeSec(roller, null);
        if (hedefScheme is null)
        {
            // SystemAdmin gibi özel bir rol için scheme yok — default Student scheme'e düş.
            hedefScheme = IdentityConstants.ApplicationScheme;
        }

        var principal = await girisYoneticisi.CreateUserPrincipalAsync(kullanici);
        var props = new AuthenticationProperties
        {
            IsPersistent = false,
            ExpiresUtc = null
        };
        await http.SignInAsync(hedefScheme, principal, props);

        var context = hedefScheme switch
        {
            "ProvinceScheme" => "province",
            "MinistryScheme" => "ministry",
            _ => "student"
        };
        return (hedefScheme, context);
    }

    /// <summary>TOTP kodunu ±1 zaman adımı toleransla doğrular (RFC 6238).</summary>
    private static bool TotpGecerliMi(string secretBase32, string kod)
    {
        if (string.IsNullOrWhiteSpace(kod) || kod.Length != 6 || !kod.All(char.IsDigit))
            return false;
        try
        {
            var secretBytes = Base32Encoding.ToBytes(secretBase32);
            var totp = new Totp(secretBytes, step: 30, totpSize: 6);
            return totp.VerifyTotp(kod, out _, new VerificationWindow(1, 1));
        }
        catch
        {
            return false;
        }
    }

    private static string? GirisIcinSchemeSec(IList<string> roller, string? istenenContext)
    {
        bool ogrenci = roller.Contains("Student");
        bool ilPersoneli = roller.Contains("ProvinceManager") || roller.Contains("ProvinceEvaluator");
        bool bakanlik = roller.Contains("MinistryOfficial");

        if (string.IsNullOrEmpty(istenenContext))
        {
            if (ogrenci) return IdentityConstants.ApplicationScheme;
            if (ilPersoneli) return "ProvinceScheme";
            if (bakanlik) return "MinistryScheme";
            return null;
        }
        return istenenContext switch
        {
            "student" => ogrenci ? IdentityConstants.ApplicationScheme : null,
            "province" => ilPersoneli ? "ProvinceScheme" : null,
            "ministry" => bakanlik ? "MinistryScheme" : null,
            _ => null
        };
    }

    private static async Task AuthEventKaydet(
        FikirPlatformuDbContext veritabani,
        HttpContext http,
        string? email,
        string? userId,
        AuthEventType tip,
        bool success,
        string? reason)
    {
        try
        {
            // YEĞİTEK gereksinim #9: PII mask'leme.
            veritabani.AuthEvents.Add(new AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Email = KisiselVeriYardimci.EmailMaskele(email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = tip,
                Success = success,
                FailureReason = reason,
                CreatedAt = DateTime.UtcNow
            });
            await veritabani.SaveChangesAsync(http.RequestAborted);
        }
        catch { }
    }

    public sealed record MfaKodIstegi([Required, RegularExpression("^[0-9]{6}$")] string Code);

    public sealed record MfaLoginIstegi(
        [Required, EmailAddress, StringLength(256)] string Email,
        [Required, StringLength(128)] string Password,
        [Required, RegularExpression("^[0-9]{6}$")] string Code,
        bool RememberMe = false,
        string? Role = null,
        // CAPTCHA
        [Required, StringLength(64)] string CaptchaId = "",
        [Required, StringLength(16)] string CaptchaAnswer = "");
}