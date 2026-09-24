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
/// MFA (TOTP) endpoint'leri (plan §2.7 — Sprint 6).
/// - /setup: secret üretir + otpauth URL döner (authenticator app elle eklenir)
/// - /verify-setup: kodu doğrular + TwoFactorEnabled=true
/// - /disable: MFA'yı kapatır
/// Login akışı: email/şifre doğruysa ve kullanıcıda MFA varsa 200 + mfaRequired=true döner;
/// frontend kullanıcıdan kodu alıp /mfa/login ile 2. adımı tamamlar.
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
        }).RequireAuthorization();

        // 2) Kurulum doğrulama — kullanıcı authenticator'dan aldığı 6 haneli kodu gönderir.
        grup.MapPost("/verify-setup", async (
            MfaKodIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
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

            if (!TotpGecerliMi(secretDuzMetin, istek.Code))
                return Results.Json(new { message = "Doğrulama kodu geçersiz." }, statusCode: 400);

            kullanici.TwoFactorEnabled = true;
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaEnabled, success: true, reason: null);
            return Results.Ok(new { message = "İki adımlı doğrulama etkinleştirildi." });
        }).RequireAuthorization();

        // 3) Login akışı 2. adımı — kullanıcı MFA kodunu gönderir, cookie yazılır.
        grup.MapPost("/login", async (
            MfaLoginIstegi istek,
            SignInManager<ApplicationUser> girisYoneticisi,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme,
            HttpContext http) =>
        {
            // CAPTCHA doğrulama (YEĞİTEK gereksinim #2).
            if (!CaptchaEndpoints.CaptchaGecerliMi(istek.CaptchaId, istek.CaptchaAnswer))
            {
                return Results.Json(new { message = "CAPTCHA doğrulaması başarısız." }, statusCode: 400);
            }

            var kullanici = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
            if (kullanici is null || !kullanici.TwoFactorEnabled || string.IsNullOrEmpty(kullanici.TwoFactorSecret))
            {
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: null,
                    AuthEventType.MfaLoginFailure, success: false, reason: "kullanici_yok_veya_mfa_kapali");
                return Results.Json(new { message = "Geçersiz istek." }, statusCode: 400);
            }

            // Şifre tekrar doğrula — frontend bu endpoint'i çağırırken şifreyi de gönderir.
            var dogrulama = await girisYoneticisi.CheckPasswordSignInAsync(kullanici, istek.Password, lockoutOnFailure: true);
            if (!dogrulama.Succeeded)
            {
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: "sifre_yanlis");
                return Results.Json(new { message = "Şifre yanlış." }, statusCode: 400);
            }

            // TOTP doğrula (30 sn pencere, ±1 step tolerans).
            var secretDuz = sifreleme.Coz(kullanici.TwoFactorSecret ?? "");
            if (string.IsNullOrEmpty(secretDuz) || !TotpGecerliMi(secretDuz, istek.Code))
            {
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: "kod_yanlis");
                return Results.Json(new { message = "Doğrulama kodu geçersiz." }, statusCode: 400);
            }

            // Cookie yaz.
            var roller = await kullaniciYoneticisi.GetRolesAsync(kullanici);
            var scheme = GirisIcinSchemeSec(roller, istek.Role);
            if (scheme is null)
            {
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: "rol_uyumsuz");
                return Results.Json(new { message = "Bu hesap için uygun context bulunamadı." }, statusCode: 403);
            }

            var principal = await girisYoneticisi.CreateUserPrincipalAsync(kullanici);
            var props = new AuthenticationProperties
            {
                IsPersistent = istek.RememberMe,
                ExpiresUtc = istek.RememberMe ? DateTimeOffset.UtcNow.AddDays(14) : null,
            };
            await http.SignInAsync(scheme, principal, props);

            await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                AuthEventType.MfaLoginSuccess, success: true, reason: $"scheme={scheme}");

            return Results.Ok(new
            {
                email = kullanici.Email,
                firstName = kullanici.FirstName,
                lastName = kullanici.LastName,
                roles = roller,
                context = scheme switch
                {
                    "ProvinceScheme" => "province",
                    "MinistryScheme" => "ministry",
                    _ => "student"
                },
                mfaUsed = true
            });
        });

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
        }).RequireAuthorization();

        return app;
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