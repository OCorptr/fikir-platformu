using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Infrastructure.Email;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OtpNet;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// MFA (iki adımlı doğrulama) endpoint'leri (Sprint 6 + Sprint 10).
/// Kullanıcı setup sırasında yöntem seçer:
///   - TOTP (Authenticator app — RFC 6238) → secret üret + otpauth URL
///   - Email OTP → e-postaya 6 hane kod gönder, kullanıcı doğrular
/// Yöntem seçimi TwoFactorMethod kolonunda saklanır.
/// Login akışı: email/şifre doğruysa ve kullanıcı MFA zorunluysa PreMfaScheme cookie yazılır;
///   - TOTP ise /mfa-login'de kullanıcı kodu girer
///   - Email ise kod otomatik gönderilir, /mfa-login'de gösterilir (veya "Tekrar gönder" butonu)
/// MFA tamamlanınca PreMfaScheme SignOut + asıl scheme SignIn (upgrade).
/// </summary>
public static class MfaEndpoints
{
    public static IEndpointRouteBuilder MapMfaEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/auth/mfa").WithTags("MFA");

        // 1) MFA kurulumu başlat — method parametresi ile.
        grup.MapPost("/setup", async (
            MfaSetupIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme,
            EmailOtpStore otpStore,
            IEmailSender epostaGonderici,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) return Results.Unauthorized();

            // Yöntem seçimi: Totp veya Email
            if (istek.Method == TwoFactorMethod.Totp)
            {
                // 20 byte (160-bit) secret — Google Authenticator standart.
                var secretBytes = KeyGeneration.GenerateRandomKey(20);
                var secretBase32 = Base32Encoding.ToString(secretBytes);
                kullanici.TwoFactorSecret = sifreleme.Sifrele(secretBase32);
                kullanici.TwoFactorMethod = TwoFactorMethod.Totp;
                kullanici.TwoFactorEnabled = false; // Verify-setup'tan sonra açılır
                await kullaniciYoneticisi.UpdateAsync(kullanici);

                var issuer = Uri.EscapeDataString("Geleceğin Fikri");
                var label = Uri.EscapeDataString(kullanici.Email ?? kullanici.Id);
                var otpauthUrl = $"otpauth://totp/{issuer}:{label}?secret={secretBase32}&issuer={issuer}&digits=6&period=30";

                await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                    AuthEventType.MfaSetupStarted, success: true, reason: "method=totp");

                return Results.Ok(new
                {
                    method = "Totp",
                    secret = secretBase32,
                    otpauthUrl,
                    digits = 6,
                    period = 30,
                    issuer
                });
            }
            else if (istek.Method == TwoFactorMethod.Email)
            {
                // E-posta OTP: test kodu gönder, kullanıcı doğrular.
                var code = otpStore.IssueCode(kullanici.Id);
                // EmailMessage.Recipient null olamaz olarak kontrol edildi
                // (yukarıda IsNullOrWhiteSpace ile) — null-forgiving (!) ile
                // compiler warning (CS8604) önlenir.
                var eposta = new EmailMessage(
                    kullanici.Email!,
                    "Geleceğin Fikri — MFA Kurulum Doğrulama",
                    $"<p>Merhaba {kullanici.FirstName},</p><p>İki adımlı doğrulama kurulumunu tamamlamak için aşağıdaki 6 haneli kodu uygulamaya girin:</p><h2 style='font-family:monospace;letter-spacing:0.3em;'>{code}</h2><p>Bu kod 5 dakika geçerlidir.</p>");
                await epostaGonderici.SendAsync(eposta, cancellationToken);

                await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                    AuthEventType.MfaSetupStarted, success: true, reason: "method=email");

                // Secret yok — e-posta OTP her seferinde yeni kod üretir.
                kullanici.TwoFactorMethod = TwoFactorMethod.Email;
                kullanici.TwoFactorEnabled = false; // Verify-setup'tan sonra açılır
                kullanici.TwoFactorSecret = null;
                await kullaniciYoneticisi.UpdateAsync(kullanici);

                return Results.Ok(new
                {
                    method = "Email",
                    emailHint = kullanici.Email?.Substring(0, Math.Min(3, kullanici.Email.Length)) + "***" // UI'da gösterilecek
                });
            }
            else
            {
                return Results.Json(new { message = "Geçersiz MFA yöntemi. 'Totp' veya 'Email' kullanın." }, statusCode: 400);
            }
        }).RequireAuthorization("PreMfaOnly");

        // 1.5) Login sonrası kullanıcının MFA method'unu döner (PreMfaScheme authenticated).
        // /me endpoint'i PreMfaScheme'i authenticate etmediği için ayrı bu endpoint lazım.
        grup.MapGet("/method", async (
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            IConfiguration cfg,
            IEmailSender epostaGonderici) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) return Results.Unauthorized();

            // Onur feedback (Sprint 10.5 / 10.7+++): Email yöntemi seçildiğinde
            // Gmail OAuth handshake tamamlanmamışsa frontend otomatik
            // /gmail-oauth/start'a yönlendirsin. providerReady kontrolü:
            //   - Gmail mode'da (Mail:Type=gmail) + RefreshToken YOK → ready=false
            //     (OAuth handshake zorunlu, mfaSendEmailOtp Gmail API call patlar)
            //   - Gmail mode + RefreshToken VAR → ready=true
            //   - Diğer mode'lar (Resend/SMTP/Development) sender tipi ne olursa
            //     olsun ready=true (sender kendi modunda çalışabilir)
            //
            // ÖNCEKI BUG: providerReady = sender != "GmailApiEmailSender" || ...
            // Bu kontrol sender tipi development'a düşmüşse bile true döndürüyordu
            // çünkü sender DevelopmentEmailSender != GmailApiEmailSender. Sonuç:
            // Gmail mode + RefreshToken yok → fallback Mod 4'e düşer + providerReady
            // true görünür + frontend handshake tetiklemez.
            var senderTip = epostaGonderici.GetType().Name;
            var tip = (cfg["Mail:Type"] ?? "").ToLowerInvariant();
            var gmailRefreshToken = cfg["Mail:Gmail:RefreshToken"];
            var gmailMode = tip == GmailApiEmailSender.SaglayiciTipi; // "gmail"
            var hasRefreshToken = !string.IsNullOrWhiteSpace(gmailRefreshToken);
            var providerReady = !gmailMode || hasRefreshToken;
            // ÖNCEKI BUG: needsGmailOAuth = !providerReady && senderTip == Gmail...
            // sender tipi Mod 4 fallback'inde DevelopmentEmailSender olduğu için
            // Gmail mode + RefreshToken yok → needsGmailOAuth hep false dönüyordu.
            // Doğrusu: Gmail mode'da + RefreshToken yok → OAuth handshake zorunlu.
            var needsGmailOAuth = gmailMode && !hasRefreshToken;

            // TOTP user için providerReady kontrolü gereksiz — yine de döndür (frontend kullanır).
            return Results.Ok(new
            {
                method = kullanici.TwoFactorMethod.ToString(),
                enabled = kullanici.TwoFactorEnabled,
                email = kullanici.Email,
                providerReady,
                needsGmailOAuth = gmailMode && !hasRefreshToken,
            });
        }).RequireAuthorization("PreMfaOnly");

        // 1.6) Email OTP kod gönder (login akışında ayrı endpoint — kullanıcı tekrar isterse).
        // PreMfaScheme authenticated, MFA etkin kullanıcılar için (method fark etmez —
        // TOTP user'lar da fallback olarak e-posta kodu isteyebilir).
        grup.MapPost("/send-email-otp", async (
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            EmailOtpStore otpStore,
            IEmailSender epostaGonderici,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null || !kullanici.TwoFactorEnabled)
                return Results.Json(new { message = "Bu hesap için MFA etkin değil." }, statusCode: 400);

            // E-posta adresi yoksa SMTP gönderimi başarısız olur; anlamlı hata dön.
            if (string.IsNullOrWhiteSpace(kullanici.Email))
                return Results.Json(new { message = "Hesabınızda e-posta adresi tanımlı değil." }, statusCode: 400);

            var code = otpStore.IssueCode(kullanici.Id);
            var eposta = new EmailMessage(
                kullanici.Email!,
                "Geleceğin Fikri — Giriş Doğrulama Kodu",
                $"<p>Merhaba {kullanici.FirstName},</p><p>Hesabınıza giriş yapmak için aşağıdaki 6 haneli kodu uygulamaya girin:</p><h2 style='font-family:monospace;letter-spacing:0.3em;'>{code}</h2><p>Bu kod 5 dakika geçerlidir. Talep etmediyseniz bu e-postayı yok sayabilirsiniz.</p>");
            await epostaGonderici.SendAsync(eposta, cancellationToken);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaLoginSuccess, success: true, reason: "email_otp_gonderildi");

            // Development ortamı (DevelopmentEmailSender) ise: kodu response'a da koy.
            // SMTP'li üretimde kod ASLA response body'de dönmemeli.
            // Type check ile concrete tip tespiti — SmtpEmailSender eklenince otomatik güvenli.
            var devModu = epostaGonderici.GetType().Name == "DevelopmentEmailSender";
            return Results.Ok(new
            {
                message = "Doğrulama kodu e-postanıza gönderildi.",
                devCode = devModu ? code : (string?)null
            });
        }).RequireAuthorization("PreMfaOnly");

        // 2) Kurulum doğrulama — method'a göre TOTP veya Email kodu.
        grup.MapPost("/verify-setup", async (
            MfaVerifyIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme,
            EmailOtpStore otpStore) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) return Results.Unauthorized();

            bool basarili = false;

            if (kullanici.TwoFactorMethod == TwoFactorMethod.Totp)
            {
                if (string.IsNullOrEmpty(kullanici.TwoFactorSecret))
                    return Results.Json(new { message = "Önce MFA kurulumunu başlatın." }, statusCode: 400);
                var secretDuz = sifreleme.Coz(kullanici.TwoFactorSecret);
                if (string.IsNullOrEmpty(secretDuz))
                    return Results.Json(new { message = "MFA secret okunamadı." }, statusCode: 400);
                basarili = TotpGecerliMi(secretDuz, istek.Code);
            }
            else if (kullanici.TwoFactorMethod == TwoFactorMethod.Email)
            {
                basarili = otpStore.Verify(kullanici.Id, istek.Code);
            }

            if (!basarili)
                return Results.Json(new { message = "Doğrulama kodu geçersiz veya süresi dolmuş." }, statusCode: 400);

            kullanici.TwoFactorEnabled = true;
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            var (hedefScheme, context) = await SchemeUpgradeYap(kullanici, kullaniciYoneticisi, girisYoneticisi, http);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaEnabled, success: true, reason: $"method={kullanici.TwoFactorMethod}");

            return Results.Ok(new
            {
                message = "İki adımlı doğrulama etkinleştirildi.",
                method = kullanici.TwoFactorMethod.ToString(),
                email = kullanici.Email,
                firstName = kullanici.FirstName,
                lastName = kullanici.LastName,
                context,
                mfaEnabled = true
            });
        }).RequireAuthorization("PreMfaOnly");

        // 3) Login sonrası MFA doğrulama — Email method ise kod gönder, TOTP ise direkt verify.
        grup.MapPost("/verify", async (
            MfaVerifyIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani,
            HassasVeriSifreleme sifreleme,
            EmailOtpStore otpStore,
            IEmailSender epostaGonderici,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null || !kullanici.TwoFactorEnabled || kullanici.TwoFactorMethod == TwoFactorMethod.None)
            {
                await AuthEventKaydet(veritabani, http, kullanici?.Email, kullanici?.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: "kullanici_yok_veya_mfa_kapali");
                return Results.Json(new { message = "Geçersiz istek." }, statusCode: 400);
            }

            bool basarili = false;
            string? basarisizSebep = null;

            if (kullanici.TwoFactorMethod == TwoFactorMethod.Totp)
            {
                if (string.IsNullOrEmpty(kullanici.TwoFactorSecret))
                {
                    await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                        AuthEventType.MfaLoginFailure, success: false, reason: "secret_yok");
                    return Results.Json(new { message = "MFA yapılandırması eksik." }, statusCode: 400);
                }
                var secretDuz = sifreleme.Coz(kullanici.TwoFactorSecret);
                if (!string.IsNullOrEmpty(secretDuz) && TotpGecerliMi(secretDuz, istek.Code))
                {
                    basarili = true;
                }
                else
                {
                    // Fallback: TOTP kodu geçersizse Email OTP'yi de dene
                    // (kullanıcı TOTP method'unda olsa bile e-posta kodu isteyebildiği için).
                    if (otpStore.Verify(kullanici.Id, istek.Code))
                    {
                        basarili = true;
                    }
                    else
                    {
                        basarisizSebep = "kod_yanlis";
                    }
                }
            }
            else if (kullanici.TwoFactorMethod == TwoFactorMethod.Email)
            {
                basarili = otpStore.Verify(kullanici.Id, istek.Code);
                if (!basarili) basarisizSebep = "email_kod_yanlis";
            }

            if (!basarili)
            {
                await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                    AuthEventType.MfaLoginFailure, success: false, reason: basarisizSebep ?? "kod_yanlis");
                var mesaj = kullanici.TwoFactorMethod == TwoFactorMethod.Email
                    ? "Doğrulama kodu geçersiz veya süresi dolmuş."
                    : "Doğrulama kodu geçersiz.";
                return Results.Json(new { message = mesaj }, statusCode: 400);
            }

            // Scheme upgrade
            var (hedefScheme, context) = await SchemeUpgradeYap(kullanici, kullaniciYoneticisi, girisYoneticisi, http);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaLoginSuccess, success: true, reason: $"method={kullanici.TwoFactorMethod}");

            return Results.Ok(new
            {
                email = kullanici.Email,
                firstName = kullanici.FirstName,
                lastName = kullanici.LastName,
                method = kullanici.TwoFactorMethod.ToString(),
                context,
                mfaVerified = true
            });
        }).RequireAuthorization("PreMfaOnly");

        // 4) MFA yöntemi değiştirme veya devre dışı bırakma — mevcut scheme authenticated user için.
        grup.MapPost("/disable", async (
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null || !kullanici.TwoFactorEnabled)
                return Results.Json(new { message = "MFA zaten kapalı." }, statusCode: 400);

            // Privileged roller MFA kapatamaz (Sprint 7).
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

            kullanici.TwoFactorEnabled = false;
            kullanici.TwoFactorSecret = null;
            kullanici.TwoFactorMethod = TwoFactorMethod.None;
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            await AuthEventKaydet(veritabani, http, kullanici.Email, kullanici.Id,
                AuthEventType.MfaDisabled, success: true, reason: null);
            return Results.Ok(new { message = "İki adımlı doğrulama kapatıldı." });
        }).RequireAuthorization("MfaCompleted");

        // 5) MFA akışından çıkış — kullanıcı vazgeçti.
        // PreMfaScheme cookie'sini temizler (yarım kalan MFA oturumu sunucuda kalmasın).
        // Identity tüm scheme cookie'lerini de siler (defense in depth).
        grup.MapPost("/cancel", async (
            HttpContext http,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani) =>
        {
            var userId = http.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var email = http.User.FindFirst(ClaimTypes.Email)?.Value;

            // PreMfa cookie'yi temizle.
            await http.SignOutAsync("PreMfaScheme");
            // Identity default scheme'i de temizle (IdentityConstants.ApplicationScheme).
            // 1. adımda SignInAsync bu scheme'le authenticate olmuş olabilir.
            await girisYoneticisi.SignOutAsync();

            // Oturum kapatma eventi logla (güvenlik denetimi için).
            await AuthEventKaydet(veritabani, http, email, userId,
                AuthEventType.Logout, success: true, reason: "mfa_akisi_iptal");

            return Results.Ok(new { message = "MFA oturumu iptal edildi." });
        }).AllowAnonymous();  // Sprint 10.7: PreMfa cookie yokken bile logout çalışsın

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
            veritabani.AuthEvents.Add(new Domain.Auth.AuthEvent
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

    public sealed record MfaSetupIstegi([Required] TwoFactorMethod Method);

    public sealed record MfaVerifyIstegi([Required, RegularExpression("^[0-9]{6}$")] string Code);
}
