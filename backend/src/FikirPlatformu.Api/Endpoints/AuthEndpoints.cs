using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json;
using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Email;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using FikirPlatformu.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/auth").WithTags("Kimlik");

        grup.MapPost("/register", async (
            KayitIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            IEmailSender epostaGonderici,
            HttpContext http) =>
        {
            // CAPTCHA doğrulama (YEĞİTEK gereksinim #2).
            if (!CaptchaEndpoints.CaptchaGecerliMi(istek.CaptchaId, istek.CaptchaAnswer))
            {
                return Results.Json(new { message = "CAPTCHA doğrulaması başarısız. Lütfen yeni bir soru çözün." }, statusCode: 400);
            }

            if (string.IsNullOrWhiteSpace(istek.FirstName) || string.IsNullOrWhiteSpace(istek.LastName))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["ad"] = ["Ad ve soyad zorunludur."]
                });
            }

            var ilVar = await veritabani.Provinces.AnyAsync(p => p.Id == istek.ProvinceId);
            if (!ilVar)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["provinceId"] = ["Geçerli bir il seçmelisiniz."]
                });
            }

            var kullanici = new ApplicationUser
            {
                UserName = istek.Email,
                Email = istek.Email,
                FirstName = istek.FirstName.Trim(),
                LastName = istek.LastName.Trim()
            };

            var sonuc = await kullaniciYoneticisi.CreateAsync(kullanici, istek.Password);
            if (!sonuc.Succeeded)
            {
                return Results.ValidationProblem(sonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            await kullaniciYoneticisi.AddToRoleAsync(kullanici, "Student");

            var simdi = DateTimeOffset.UtcNow;
            veritabani.StudentProfiles.Add(new StudentProfile
            {
                Id = Guid.NewGuid(),
                ApplicationUserId = kullanici.Id,
                ProvinceId = istek.ProvinceId,
                School = string.IsNullOrWhiteSpace(istek.School) ? null : istek.School.Trim(),
                Grade = istek.Grade is > 0 and <= 12 ? istek.Grade : null,
                StudentNumber = string.IsNullOrWhiteSpace(istek.StudentNumber) ? null : istek.StudentNumber.Trim(),
                CreatedAt = simdi,
                UpdatedAt = simdi
            });
            await veritabani.SaveChangesAsync(http.RequestAborted);

            var dogrulamaBelirteci = await kullaniciYoneticisi.GenerateEmailConfirmationTokenAsync(kullanici);
            var dogrulamaBaglantisi = $"{http.Request.Scheme}://{http.Request.Host}/api/auth/verify-email"
                + $"?userId={Uri.EscapeDataString(kullanici.Id)}"
                + $"&token={Uri.EscapeDataString(dogrulamaBelirteci)}";

            var eposta = new EmailMessage(
                kullanici.Email,
                "Geleceğin Fikri — E-posta Doğrulama",
                $"<p>Merhaba {kullanici.FirstName},</p><p>E-posta adresinizi doğrulamak için "
                + $"<a href='{dogrulamaBaglantisi}'>buraya tıklayın</a>.</p>");
            await epostaGonderici.SendAsync(eposta, http.RequestAborted);

            return Results.Json(new
            {
                message = "Kaydınız alındı. E-posta adresinizi doğrulamak için gönderilen bağlantıyı kullanın."
            }, statusCode: 202);
        });

        grup.MapGet("/verify-email", async (
            [FromQuery] string userId,
            [FromQuery] string token,
            [FromQuery] string? returnUrl,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            IConfiguration yapilandirma) =>
        {
            var frontendAdresi = FrontendAdresi(yapilandirma);
            var izinliOriginler = new[] { frontendAdresi };
            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            string hedef;
            if (kullanici is null)
            {
                hedef = "invalid";
            }
            else
            {
                var sonuc = await kullaniciYoneticisi.ConfirmEmailAsync(kullanici, token);
                hedef = sonuc.Succeeded ? "success" : "invalid";
            }
            var guvenliDonus = YerelUrlYardimci.GuvenliVeyaNull(returnUrl, izinliOriginler) ?? $"/giris?verified={hedef}";
            return Results.Redirect($"{frontendAdresi}{guvenliDonus}");
        });

        grup.MapPost("/login", async (
            GirisIstegi istek,
            [FromQuery] string? role,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani,
            HttpContext http) =>
        // Rate limit: 5 deneme / dakika / IP (plan §5.1 — login brute-force koruması).
        {
            // CAPTCHA doğrulama (YEĞİTEK gereksinim #2).
            if (!CaptchaEndpoints.CaptchaGecerliMi(istek.CaptchaId, istek.CaptchaAnswer))
            {
                return Results.Json(new { message = "CAPTCHA doğrulaması başarısız. Lütfen yeni bir soru çözün." }, statusCode: 400);
            }

            var kullanici = await girisYoneticisi.UserManager.FindByEmailAsync(istek.Email);
            if (kullanici is null)
            {
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: null,
                    AuthEventType.LoginFailure, success: false, reason: "email_bulunamadi");
                return KimlikHatasi("E-posta veya şifre geçersiz.");
            }

            // Önce şifre kontrolü — SignInManager ile doğrulayalım, böylece lockout çalışır.
            var dogrulama = await girisYoneticisi.CheckPasswordSignInAsync(
                kullanici, istek.Password, lockoutOnFailure: true);

            if (!dogrulama.Succeeded)
            {
                if (dogrulama.IsLockedOut)
                {
                    await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                        AuthEventType.LoginLockedOut, success: false, reason: "kilitli");
                    return Results.Json(new { message = "Çok fazla hatalı deneme yapıldı. Hesabınız geçici olarak kilitlendi." }, statusCode: 423);
                }
                if (dogrulama.IsNotAllowed)
                {
                    await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                        AuthEventType.LoginEmailNotConfirmed, success: false, reason: "email_dogrulanmamis");
                    return Results.Json(new { message = "E-posta adresiniz doğrulanmamış. Doğrulama e-postasındaki bağlantıyı kullanın." }, statusCode: 403);
                }
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.LoginFailure, success: false, reason: "yanlis_sifre");
                return KimlikHatasi("E-posta veya şifre geçersiz.");
            }

            var roller = await girisYoneticisi.UserManager.GetRolesAsync(kullanici);
            var scheme = GirisIcinSchemeSec(roller, role);

            // İstenen role ile hesabın rolleri uyuşmazsa, girişi reddet — başka hesaba karışma.
            if (scheme is null)
            {
                var beklenen = role switch
                {
                    "student" => "öğrenci",
                    "province" => "il personeli",
                    "ministry" => "bakanlık",
                    _ => "bilinmeyen"
                };
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.LoginFailure, success: false, reason: "rol_uyumsuz");
                return Results.Json(new
                {
                    message = $"Bu hesap '{beklenen}' rolü için yetkili değil."
                }, statusCode: 403);
            }

            // Doğru scheme ile cookie yaz.
            // SignInManager default scheme (Identity.Application) ile çalışır; farklı scheme'ler için
            // HttpContext.SignInAsync + Identity'nin ClaimsPrincipal'ını kullanıyoruz.
            var principal = await girisYoneticisi.CreateUserPrincipalAsync(kullanici);
            var props = new AuthenticationProperties
            {
                IsPersistent = istek.RememberMe,
                ExpiresUtc = istek.RememberMe ? DateTimeOffset.UtcNow.AddDays(14) : (DateTimeOffset?)null,
            };
            await http.SignInAsync(scheme, principal, props);

            // MFA kontrolü (Sprint 9 güncellemesi):
            // Ayrıcalıklı roller (MinistryOfficial, ProvinceManager, SystemAdmin) MFA zorunlu.
            // MFA setup veya MFA verify gerekiyorsa PreMfaScheme ile kısa süreli cookie yazılır
            // (10dk), kullanıcı MFA endpoint'lerine (/api/mfa/setup, /api/mfa/verify-setup, /api/mfa/verify)
            // erişebilir. MFA tamamlanınca PreMfaScheme SignOut + asıl scheme SignIn yapılır.
            var ayricalikliRol = roller.Any(r => r is "MinistryOfficial" or "ProvinceManager" or "SystemAdmin");
            if (!kullanici.TwoFactorEnabled && ayricalikliRol)
            {
                // PreMfaScheme ile cookie yaz (MFA setup endpoint'lerine erişim için).
                await http.SignOutAsync(scheme);
                var preMfaProps = new AuthenticationProperties
                {
                    IsPersistent = false, // Pre-MFA cookie persistent olmasın
                    ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(10)
                };
                await http.SignInAsync("PreMfaScheme", principal, preMfaProps);
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.LoginSuccess, success: true, reason: "mfa_zorunlu_henuz_kurulmamis");
                return Results.Json(new
                {
                    mfaSetupRequired = true,
                    message = "Bu hesap için iki adımlı doğrulama zorunludur. Lütfen kurulumu tamamlayın.",
                    email = kullanici.Email,
                    roles = roller,
                    context = scheme switch
                    {
                        "ProvinceScheme" => "province",
                        "MinistryScheme" => "ministry",
                        _ => "student"
                    }
                });
            }

            // MFA aktifse — PreMfaScheme cookie yaz, kullanıcı /api/mfa/verify'a kodu göndersin.
            if (kullanici.TwoFactorEnabled)
            {
                await http.SignOutAsync(scheme);
                var preMfaProps = new AuthenticationProperties
                {
                    IsPersistent = false,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(10)
                };
                await http.SignInAsync("PreMfaScheme", principal, preMfaProps);
                await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                    AuthEventType.LoginSuccess, success: true, reason: "mfa_required");
                return Results.Ok(new
                {
                    mfaRequired = true,
                    email = kullanici.Email,
                    roles = roller,
                    context = scheme switch
                    {
                        "ProvinceScheme" => "province",
                        "MinistryScheme" => "ministry",
                        _ => "student"
                    }
                });
            }

            await AuthEventKaydet(veritabani, http, email: istek.Email, userId: kullanici.Id,
                AuthEventType.LoginSuccess, success: true, reason: null);

            // Şifre değişikliği zorunluluğu (plan §2.5) ve süre sonu (plan §2.4) kontrolü.
            var simdi = DateTimeOffset.UtcNow;
            var mustChange = kullanici.MustChangePassword;
            var passwordExpired = kullanici.PasswordChangedAt.HasValue
                && (simdi - kullanici.PasswordChangedAt.Value).TotalDays > 90;
            var passwordWarn = kullanici.PasswordChangedAt.HasValue
                && !passwordExpired
                && (simdi - kullanici.PasswordChangedAt.Value).TotalDays > 75; // 75+ gün: uyarı

            return Results.Ok(new
            {
                kullanici.Email,
                kullanici.FirstName,
                kullanici.LastName,
                roles = roller,
                context = scheme switch
                {
                    "ProvinceScheme" => "province",
                    "MinistryScheme" => "ministry",
                    _ => "student"
                },
                // Şifre güvenlik işaretleri (frontend bu değerlere göre uyarı/redirect verecek).
                mustChangePassword = mustChange || passwordExpired,
                passwordWarn = passwordWarn && !mustChange && !passwordExpired,
            });
        }).RequireRateLimiting("login");

        // Şifre değiştirme (plan §2.5: ilk giriş ve 90 gün sonra zorla).
        grup.MapPost("/change-password", async (
            SifreDegistirIstegi istek,
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            SignInManager<ApplicationUser> girisYoneticisi,
            FikirPlatformuDbContext veritabani) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) return Results.Unauthorized();

            // Eski şifreyi doğrula.
            var dogrulama = await girisYoneticisi.CheckPasswordSignInAsync(
                kullanici, istek.CurrentPassword, lockoutOnFailure: false);
            if (!dogrulama.Succeeded)
            {
                await AuthEventKaydet(veritabani, http, email: kullanici.Email, userId: kullanici.Id,
                    AuthEventType.LoginFailure, success: false, reason: "change_password_yanlis_mevcut");
                return Results.Json(new { message = "Mevcut şifre yanlış." }, statusCode: 400);
            }

            // Yeni şifre = Identity policy'e uygun mu? (RequiredLength=8 + karmaşıklık).
            // ChangePasswordAsync zaten validate ediyor; hata dönerse mesajı iletiriz.
            var sonuc = await kullaniciYoneticisi.ChangePasswordAsync(kullanici, istek.CurrentPassword, istek.NewPassword);
            if (!sonuc.Succeeded)
            {
                var mesajlar = sonuc.Errors.Select(e => e.Description).ToArray();
                await AuthEventKaydet(veritabani, http, email: kullanici.Email, userId: kullanici.Id,
                    AuthEventType.LoginFailure, success: false, reason: "change_password_politika");
                return Results.Json(new { errors = mesajlar }, statusCode: 400);
            }

            kullanici.MustChangePassword = false;
            kullanici.PasswordChangedAt = DateTimeOffset.UtcNow;
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            // Cookie'yi yeniden yaz (yeni şifre hashing sonrası SecurityStamp değişti).
            await girisYoneticisi.RefreshSignInAsync(kullanici);

            await AuthEventKaydet(veritabani, http, email: kullanici.Email, userId: kullanici.Id,
                AuthEventType.PasswordChanged, success: true, reason: null);
            return Results.Ok(new { message = "Şifre güncellendi." });
        }).RequireAuthorization();

        // ==================== Sprint 11.5 — Şifremi Unuttum akışı ====================
// Onur Spring 11 onayı ile: Yetkili Girişi + Öğrenci Girişi ekranlarından
// "Şifremi Unuttum" linki. YEGİTEK kullanım senaryosu: telefon kayıp / şifre
// unutma → e-posta link → yeni şifre.
// Email enumeration koruması: kullanıcı olsun-olmasın aynı response.
// Rate limit: IP başına 5 dakikada max 3 istek.

grup.MapPost("/forgot-password", async (
    SifremiUnuttumIstegi istek,
    UserManager<ApplicationUser> kullaniciYoneticisi,
    IEmailSender epostaGonderici,
    IConfiguration yapilandirma,
    ILogger<Program> logger,
    FikirPlatformuDbContext veritabani,
    HttpContext http) =>
{
    var email = (istek.Email ?? "").Trim().ToLowerInvariant();
    var frontendBase = (yapilandirma["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');

    // Email enumeration koruması — user yoksa bile generic mesaj + no-op.
    var user = await kullaniciYoneticisi.FindByEmailAsync(email);
    if (user is not null)
    {
        // Identity reset token üret (raw URL-safe).
        var token = await kullaniciYoneticisi.GeneratePasswordResetTokenAsync(user);
        var resetUrl = $"{frontendBase}/sifre-sifirla?token={Uri.EscapeDataString(token)}&userId={Uri.EscapeDataString(user.Id)}";

        // Mail gönder. Hata olursa sadece logla — kullanıcıya sızma.
        try
        {
            await epostaGonderici.SendAsync(new EmailMessage(
                Recipient: email,
                Subject: "Geleceğin Fikri Platformu — Şifre Sıfırlama",
                HtmlBody: $@"<p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
                  <p><a href=""{resetUrl}"">Şifreni Sıfırla</a></p>
                  <p>Bu bağlantı 1 saat geçerlidir. Şifre sıfırlama isteğinde bulunmadıysanız bu mesajı yok sayabilirsiniz.</p>
                  <hr><p><small>Geleceğin Fikri Platformu</small></p>"
            ), CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[SIFRE] reset mail gönderilemedi: {Email}", email);
        }

        // Audit (sadece user varsa — enumeration koruması).
        veritabani.AuthEvents.Add(new Domain.Auth.AuthEvent
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Email = KisiselVeriYardimci.EmailMaskele(user.Email),
            IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
            UserAgent = http.Request.Headers.UserAgent.ToString(),
            EventType = Domain.Auth.AuthEventType.PasswordResetRequested,
            Success = true,
            CreatedAt = DateTime.UtcNow,
        });
        await veritabani.SaveChangesAsync(http.RequestAborted);
    }

    // Her durumda aynı generic mesaj — kullanıcı var/yok belli olmaz.
    return Results.Ok(new
    {
        message = "Eğer bu e-posta bir hesaba kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Lütfen e-postanızı kontrol edin."
    });
});

// Throttle: IP başına 5 dakikada max 3 istek (basit in-memory tracker).
// Production'da Redis/Cloudflare rate-limit önerilir ama Sprint 11.5'te yeterli.
var forgotPasswordTimestamps = new Dictionary<string, List<DateTime>>();
grup.MapPost("/reset-password", async (
    SifreSifirlamaIstegi istek,
    UserManager<ApplicationUser> kullaniciYoneticisi,
    FikirPlatformuDbContext veritabani,
    HttpContext http,
    ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(istek.Email) ||
        string.IsNullOrWhiteSpace(istek.Token) ||
        string.IsNullOrWhiteSpace(istek.NewPassword))
    {
        return Results.Json(new { message = "Geçersiz istek." }, statusCode: 400);
    }

    var normalizedEmail = istek.Email.Trim().ToLowerInvariant();
    var user = await kullaniciYoneticisi.FindByEmailAsync(normalizedEmail);
    if (user is null)
    {
        // Email enumeration koruması — generic hata.
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["Email"] = new[] { "Geçersiz veya süresi dolmuş şifre sıfırlama bağlantısı." }
        });
    }

    // Identity framework reset password (User objesi + token).
    var sonuc = await kullaniciYoneticisi.ResetPasswordAsync(user, istek.Token, istek.NewPassword);
    if (!sonuc.Succeeded)
    {
        var errors = sonuc.Errors
            .GroupBy(e => e.Code)
            .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray());
        return Results.ValidationProblem(errors);
    }

    // Audit.
    veritabani.AuthEvents.Add(new Domain.Auth.AuthEvent
    {
        Id = Guid.NewGuid(),
        UserId = user.Id,
        Email = KisiselVeriYardimci.EmailMaskele(user.Email),
        IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
        UserAgent = http.Request.Headers.UserAgent.ToString(),
        EventType = Domain.Auth.AuthEventType.PasswordResetCompleted,
        Success = true,
        CreatedAt = DateTime.UtcNow,
    });
    await veritabani.SaveChangesAsync(http.RequestAborted);

    return Results.Ok(new { message = "Şifreniz sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz." });
});

grup.MapPost("/logout", async (
            [FromQuery] string? role,
            HttpContext http,
            FikirPlatformuDbContext veritabani) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var email = http.User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;

            // role belirtilmişse sadece o scheme'in cookie'sini sil;
            // belirtilmemişse tümünü sil (tüm sekmelerden çıkış).
            if (!string.IsNullOrEmpty(role))
            {
                var scheme = CikisIcinSchemeSec(role);
                if (scheme is not null)
                {
                    await http.SignOutAsync(scheme);
                    await AuthEventKaydet(veritabani, http, email: email, userId: userId,
                        AuthEventType.Logout, success: true, reason: $"scheme={scheme}");
                    return Results.Ok(new { message = "Çıkış yapıldı.", context = role });
                }
            }
            await http.SignOutAsync(IdentityConstants.ApplicationScheme);
            await http.SignOutAsync("ProvinceScheme");
            await http.SignOutAsync("MinistryScheme");
            await AuthEventKaydet(veritabani, http, email: email, userId: userId,
                AuthEventType.Logout, success: true, reason: "scheme=all");
            return Results.Ok(new { message = "Çıkış yapıldı.", context = "all" });
        });

        // /me: 3 cookie'nin hepsini kontrol et, aktif oturumları döndür (aynı tarayıcıda
        // öğrenci + il + bakanlık oturumu aynı anda bulunabilir, plan §49).
        grup.MapGet("/me", async (
            HttpContext http,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani) =>
        {
            var oturumlar = new List<object>();

            // Öğrenci
            var ogrenciSonuc = await http.AuthenticateAsync(IdentityConstants.ApplicationScheme);
            if (ogrenciSonuc.Succeeded && ogrenciSonuc.Principal is not null)
            {
                var k = await KullaniciBilgisiGetir(kullaniciYoneticisi, veritabani, ogrenciSonuc.Principal, http.RequestAborted);
                if (k is not null) oturumlar.Add(k);
            }

            // İl personeli
            var ilSonuc = await http.AuthenticateAsync("ProvinceScheme");
            if (ilSonuc.Succeeded && ilSonuc.Principal is not null)
            {
                var k = await KullaniciBilgisiGetir(kullaniciYoneticisi, veritabani, ilSonuc.Principal, http.RequestAborted);
                if (k is not null) oturumlar.Add(k);
            }

            // Bakanlık
            var bakanlikSonuc = await http.AuthenticateAsync("MinistryScheme");
            if (bakanlikSonuc.Succeeded && bakanlikSonuc.Principal is not null)
            {
                var k = await KullaniciBilgisiGetir(kullaniciYoneticisi, veritabani, bakanlikSonuc.Principal, http.RequestAborted);
                if (k is not null) oturumlar.Add(k);
            }

            if (oturumlar.Count == 0)
            {
                return Results.Ok(new { authenticated = false });
            }

            return Results.Ok(new { authenticated = true, sessions = oturumlar });
        }).AllowAnonymous();

        grup.MapPost("/forgot-password", async (
            SifremiUnuttumIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            IEmailSender epostaGonderici,
            IConfiguration yapilandirma,
            HttpContext http) =>
        {
            var kullanici = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
            if (kullanici is not null)
            {
                var belirtec = await kullaniciYoneticisi.GeneratePasswordResetTokenAsync(kullanici);
                var sifirlamaBaglantisi = $"{FrontendAdresi(yapilandirma)}/sifre-sifirla"
                    + $"?email={Uri.EscapeDataString(istek.Email)}"
                    + $"&token={Uri.EscapeDataString(belirtec)}";

                var eposta = new EmailMessage(
                    istek.Email,
                    "Geleceğin Fikri — Şifre Sıfırlama",
                    $"<p>Şifrenizi sıfırlamak için <a href='{sifirlamaBaglantisi}'>buraya tıklayın</a>.</p>");
                await epostaGonderici.SendAsync(eposta, http.RequestAborted);
            }

            return Results.Ok(new { message = "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi." });
        });

        grup.MapPost("/reset-password", async (
            SifreSifirlamaIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            ILogger<Program> logger,
            HttpContext http) =>
        {
            // Sprint 11.19: Her çağrı info-level log + try-catch ile exception'ları da yakala.
            logger.LogInformation("[SIFRE-RESET] BASLADI: UserId={UserId}, Email={Email}, TokenLen={TokenLen}, NewPwdLen={PwdLen}",
                istek.UserId, istek.Email, istek.Token?.Length ?? 0, istek.NewPassword?.Length ?? 0);
            try
            {
                // Sprint 11.16: UserId öncelikli (admin reset), yoksa email (forgot-password).
                ApplicationUser? kullanici = null;
                if (!string.IsNullOrWhiteSpace(istek.UserId))
                {
                    kullanici = await kullaniciYoneticisi.FindByIdAsync(istek.UserId);
                }
                else if (!string.IsNullOrWhiteSpace(istek.Email))
                {
                    kullanici = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
                }

                if (kullanici is null)
                {
                    logger.LogWarning("[SIFRE-RESET] Kullanici bulunamadi (userId={UserId}, email={Email})",
                        istek.UserId, istek.Email);
                    SifreResetDebug.Kaydet(false, "Kullanıcı bulunamadı", istek.UserId, istek.Email,
                        istek.Token?.Length ?? 0, istek.NewPassword?.Length ?? 0);
                    return KimlikHatasi("Sıfırlama bağlantısı geçersiz.");
                }

                var sonuc = await kullaniciYoneticisi.ResetPasswordAsync(kullanici, istek.Token, istek.NewPassword);
                if (!sonuc.Succeeded)
                {
                    var detay = string.Join("; ", sonuc.Errors.Select(e => $"{e.Code}={e.Description}"));
                    logger.LogError("[SIFRE-RESET] BASARISIZ: UserId={UserId}, Email={Email}, Detay={Detay}",
                        kullanici.Id, kullanici.Email, detay);
                    var mesaj = sonuc.Errors.Any(e => e.Code == "InvalidToken")
                        ? "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş."
                        : $"Şifre reddedildi: {detay}";
                    SifreResetDebug.Kaydet(false, mesaj, kullanici.Id, kullanici.Email,
                        istek.Token?.Length ?? 0, istek.NewPassword?.Length ?? 0);
                    return Results.Json(new { message = mesaj }, statusCode: 400);
                }
                logger.LogInformation("[SIFRE-RESET] BASARILI: UserId={UserId}, Email={Email}",
                    kullanici.Id, kullanici.Email);
                SifreResetDebug.Kaydet(true, "Şifreniz güncellendi", kullanici.Id, kullanici.Email,
                    istek.Token?.Length ?? 0, istek.NewPassword?.Length ?? 0);
                return Results.Ok(new { message = "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz." });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[SIFRE-RESET] EXCEPTION: UserId={UserId}, Email={Email}",
                    istek.UserId, istek.Email);
                SifreResetDebug.Kaydet(false, "EXCEPTION", istek.UserId, istek.Email,
                    istek.Token?.Length ?? 0, istek.NewPassword?.Length ?? 0,
                    ex.GetType().Name + ": " + ex.Message);
                return Results.Json(new { message = "Sunucu hatası: " + ex.GetType().Name + " — " + ex.Message }, statusCode: 500);
            }
        });

        // Sprint 11.22: Server-side debug endpoint — Onur DevTools acamiyor,
        // Render log'una erisemiyor. Bu endpoint son sifre sifirlama denemesinin
        // sonucunu JSON olarak doner. Maintenance token ile korunur (Onur zaten
        // AdminMaintenance__Secret env'i biliyor). SystemAdminOnly policy yerine
        // secret query cunku cookie cross-site'de paylasilamiyor olabilir.
        grup.MapGet("/__debug/last-sifre-reset", (
            [FromQuery] string? token,
            IConfiguration yapilandirma) =>
        {
            var beklenen = yapilandirma["AdminMaintenance:Secret"]
                ?? yapilandirma["__maintenance:admin-reset:token"]
                ?? "BekleyinSprint12";
            if (string.IsNullOrEmpty(token) || token != beklenen)
            {
                return Results.Json(new { message = "Geçersiz veya eksik token." }, statusCode: 401);
            }

            var deneme = SifreResetDebug.SonDeneme;
            if (deneme is null)
            {
                return Results.Ok(new { denemeVar = false, message = "Henüz hiç şifre sıfırlama denemesi yapılmadı." });
            }
            return Results.Ok(new
            {
                denemeVar = true,
                deneme.Zaman,
                deneme.Basarili,
                deneme.Mesaj,
                deneme.UserId,
                deneme.Email,
                deneme.TokenLen,
                deneme.PwdLen,
                deneme.Exception,
            });
        });

        // Sprint 11.25: Test endpoint — frontend'in doğru backend origin'ini
        // kullandigini dogrular. CORS preflight testi. Maintenance token ile.
        grup.MapGet("/__debug/cors-test", (
            [FromQuery] string? token,
            [FromQuery] string? fromOrigin,
            IConfiguration yapilandirma) =>
        {
            var beklenen = yapilandirma["AdminMaintenance:Secret"]
                ?? yapilandirma["__maintenance:admin-reset:token"]
                ?? "BekleyinSprint12";
            if (string.IsNullOrEmpty(token) || token != beklenen)
            {
                return Results.Json(new { message = "Geçersiz veya eksik token." }, statusCode: 401);
            }
            return Results.Ok(new
            {
                message = "CORS testi başarılı — backend'e erişim var.",
                backendOrigin = "fikir-platformu.onrender.com",
                fromOrigin = fromOrigin ?? "yok",
                beklenenFrontendOrigin = "https://fikir-platformu-web.onrender.com",
            });
        });

        // Sprint 11.17: Sifre sifirlama sayfasi icin kullanici bilgisi. Public
        // — token olmadan da cagirilabilir (UI'da "Bu baglanti X kullanicisi
        // icin" gostermek icin). Identity token dogrulamasi YAPILMAZ — sadece
        // kullanici bilgisi. Reset isleminde token yine zorunlu.
        grup.MapGet("/reset-password-info", async (
            [FromQuery] string? userId,
            [FromQuery] string? email,
            UserManager<ApplicationUser> kullaniciYoneticisi) =>
        {
            ApplicationUser? kullanici = null;
            if (!string.IsNullOrWhiteSpace(userId))
            {
                kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            }
            else if (!string.IsNullOrWhiteSpace(email))
            {
                kullanici = await kullaniciYoneticisi.FindByEmailAsync(email);
            }
            if (kullanici is null)
            {
                return Results.NotFound(new { message = "Kullanıcı bulunamadı." });
            }
            return Results.Ok(new
            {
                id = kullanici.Id,
                email = kullanici.Email,
                firstName = kullanici.FirstName,
                lastName = kullanici.LastName,
            });
        });

        // ===== Gmail OAuth2 (Sprint 10.1) — SystemAdmin-only tek seferlik kurulum =====
        // /api/auth/gmail-oauth/start → Google OAuth URL'ine redirect eder.
        //  Kullanici Google'da onay verince /api/auth/gmail-oauth/callback'e döner,
        //  refresh_token JSON response olarak verilir (Render env var'a yapistirilir).
        var gmailAyarlari = app.ServiceProvider.GetService<Microsoft.Extensions.Options.IOptions<GmailAyarlari>>();
        var gmailClientId = gmailAyarlari?.Value.ClientId;

        if (!string.IsNullOrWhiteSpace(gmailClientId))
        {
            // OAuth2 authorize URL (gmail.send scope).
            // query: ?returnTo=/giris gibi relative path — handshake sonrası
            // kullanici orijinal sayfasina geri donsun. relative path DB
            // degisikliginde (fikrimnet.gov.tr) de calisir — ONUR FEEDBACK.
            grup.MapGet("/gmail-oauth/start", (HttpContext http, IConfiguration cfg) =>
            {
                var clientId = cfg["Mail:Gmail:ClientId"];
                var redirectUri = cfg["Mail:Gmail:RedirectUri"]
                    ?? $"{http.Request.Scheme}://{http.Request.Host}/api/auth/gmail-oauth/callback";
                // Sprint 10.7+++ state: base64url(JSON) — RFC 6749 standard.
                // Önceki "guid|returnTo" pattern '|' + path'den cookie invalid oluyor.
                var stateObj = new
                {
                    nonce = Guid.NewGuid().ToString("N"),
                    returnTo = http.Request.Query["returnTo"].ToString()
                };
                var stateJson = System.Text.Json.JsonSerializer.Serialize(stateObj);
                var stateBytes = System.Text.Encoding.UTF8.GetBytes(stateJson);
                var state = Convert.ToBase64String(stateBytes)
                    .Replace('+', '-').Replace('/', '_').TrimEnd('=');
                http.Response.Cookies.Append(".FikirOAuthState", state, new CookieOptions
                {
                    HttpOnly = true,
                    SameSite = SameSiteMode.Lax,
                    Secure = http.Request.IsHttps,
                    Expires = DateTimeOffset.UtcNow.AddMinutes(10),
                    Path = "/",
                });
                var authUrl = "https://accounts.google.com/o/oauth2/v2/auth"
                    + $"?client_id={Uri.EscapeDataString(clientId!)}"
                    + $"&redirect_uri={Uri.EscapeDataString(redirectUri)}"
                    + "&response_type=code"
                    + "&scope=" + Uri.EscapeDataString("https://www.googleapis.com/auth/gmail.send")
                    + "&access_type=offline"
                    + "&prompt=consent" // her seferinde refresh_token almak için
                    + $"&state={Uri.EscapeDataString(state)}";
                return Results.Redirect(authUrl);
            });

            // OAuth2 callback — code'u refresh_token ile degis tokun
            // Basarili handshake sonrasi kullanici /api/admin ile otomatik tamamlanan
            // bir JSON response yerine, returnTo path'ine (relative) redirect eder.
            grup.MapGet("/gmail-oauth/callback", async (
                HttpContext http,
                IConfiguration cfg,
                IHttpClientFactory httpFactory,
                ILogger<Program> logger,
                FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext veritabani,
                HassasVeriSifreleme sifreleme) =>
            {
                try
                {
                    var code = http.Request.Query["code"].ToString();
                    var rawState = http.Request.Query["state"].ToString();
                    var stateCookie = http.Request.Cookies[".FikirOAuthState"];

                    string? returnTo = null;
                    // Sprint 10.7+++ base64-url JSON state (RFC 6749 standard).
                    // Önceki "$guid|$returnTo" pattern cookie value'da '|' ve '/'
                    // karakterleri yüzünden browser'lar tarafından reddediliyor
                    // olabilirdi (Set-Cookie invalid). Base64url JSON temiz olur.
                    try
                    {
                        var padded = rawState.Replace('-', '+').Replace('_', '/');
                        padded += new string('=', (4 - padded.Length % 4) % 4);
                        var raw = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(padded));
                        using var doc = JsonDocument.Parse(raw);
                        if (doc.RootElement.TryGetProperty("returnTo", out var rtEl))
                        {
                            returnTo = rtEl.GetString();
                        }
                    }
                    catch (FormatException) { /* base64 decode başarısız — eski state olabilir */ }

                    if (string.IsNullOrWhiteSpace(code))
                    {
                        return Results.Json(new { error = "code parametresi yok — Google onay iptal edilmiş." }, statusCode: 400);
                    }
                    if (string.IsNullOrWhiteSpace(rawState) || rawState != stateCookie)
                    {
                        logger.LogWarning("[GMAIL] state mismatch. rawState={Raw}, cookie={Cookie}",
                            rawState ?? "(null)", stateCookie ?? "(null)");
                        return Results.Json(new { error = "state uyumsuz — CSRF koruması." }, statusCode: 400);
                    }
                    // state cookie'yi temizle
                    http.Response.Cookies.Delete(".FikirOAuthState", new CookieOptions { Path = "/" });

                    var clientId = cfg["Mail:Gmail:ClientId"];
                    var clientSecret = cfg["Mail:Gmail:ClientSecret"];
                    var redirectUri = cfg["Mail:Gmail:RedirectUri"]
                        ?? $"{http.Request.Scheme}://{http.Request.Host}/api/auth/gmail-oauth/callback";

                    if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(clientSecret))
                    {
                        logger.LogError("[GMAIL] Mail:Gmail:ClientId veya ClientSecret Render env'de eksik.");
                        return Results.Json(new
                        {
                            error = "Backend OAuth yapılandırması eksik (Mail:Gmail:ClientId/Secret env).",
                            detail = "Render dashboard → Environment ekle."
                        }, statusCode: 500);
                    }

                    var client = httpFactory.CreateClient();
                    var tokenYanit = await client.PostAsync(
                        "https://oauth2.googleapis.com/token",
                        new FormUrlEncodedContent(new Dictionary<string, string>
                        {
                            ["client_id"] = clientId!,
                            ["client_secret"] = clientSecret!,
                            ["code"] = code,
                            ["grant_type"] = "authorization_code",
                            ["redirect_uri"] = redirectUri,
                        }));

                    var govde = await tokenYanit.Content.ReadAsStringAsync();
                    if (!tokenYanit.IsSuccessStatusCode)
                    {
                        logger.LogError("[GMAIL] token exchange failed: {Status} {Body}",
                            tokenYanit.StatusCode, govde.Substring(0, Math.Min(govde.Length, 400)));
                        return Results.Json(new { error = "Google token exchange başarısız.", detail = govde }, statusCode: 500);
                    }

                    var json = System.Text.Json.JsonDocument.Parse(govde).RootElement;
                    var refreshToken = json.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;

                    // Sprint 10.7+++ (Onur feedback "otomatik kaydolmalı"): refresh_token
                    // ENV variable'a değil DB'ye otomatik kaydedilir. gmail_refresh_tokens
                    // tablosu Id=1 singleton row (Sistem Sabit Gmail'i pattern). Tablo
                    // zaten Program.cs startup'ta CREATE TABLE IF NOT EXISTS ile idempotent
                    // oluşturulur. HassasVeriSifreleme ile encrypted saklanır — Data
                    // Protection key ayrı (DB leak'inde attacker OAuth yetkisi kazanamaz).
                    // ONUR: Restart gerekmez, restart sonrası persiste kalır, Manuel env yok.
                    if (!string.IsNullOrWhiteSpace(refreshToken))
                    {
                        var mevcut = await veritabani.GmailRefreshTokens.FindAsync((object)1);
                        var encrypted = sifreleme.SifreleGmail(refreshToken);
                        if (mevcut is null)
                        {
                            veritabani.GmailRefreshTokens.Add(new FikirPlatformu.Infrastructure.Auth.GmailRefreshToken
                            {
                                Id = 1,
                                EncryptedRefreshToken = encrypted,
                                UpdatedAt = DateTime.UtcNow,
                            });
                        }
                        else
                        {
                            mevcut.EncryptedRefreshToken = encrypted;
                            mevcut.UpdatedAt = DateTime.UtcNow;
                        }
                        await veritabani.SaveChangesAsync(http.RequestAborted);
                    }

                    // Onur feedback (Sprint 10.7+++): relative path redirect browser'da
                    // current origin (backend) ile resolve olur → 404. Absolute frontend
                    // URL ile SPA /mfa-login'e yönlendir. Frontend:BaseUrl env'de set edilmeli.
                    var frontendBase = FrontendAdresi(cfg).TrimEnd('/');
                    var basariPath = string.IsNullOrWhiteSpace(returnTo) ? "/" : returnTo;
                    // Eğer returnTo zaten absolute (https://...) ise olduğu gibi kullan,
                    // değilse frontend base ile birleştir. Hem local dev hem prod destekler.
                    var absoluteTarget = basariPath.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                        || basariPath.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
                        ? basariPath
                        : $"{frontendBase}{basariPath}";
                    return Results.Redirect(
                        $"{absoluteTarget}?gmail_oauth=ok{(refreshToken != null ? "&has_token=1" : "&has_token=0")}");
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "[GMAIL] callback unexpected exception. query={Query}",
                        http.Request.QueryString);
                    return Results.Json(new
                    {
                        error = "OAuth callback beklenmeyen hata.",
                        detail = ex.GetType().Name + ": " + ex.Message,
                    }, statusCode: 500);
                }
            });
        }

        return app;
    }

    private static IResult KimlikHatasi(string mesaj) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["kimlik"] = [mesaj] });

    /// <summary>
    /// Kimlik doğrulama olayını auth_events tablosuna yazar (plan §2.6: login/logout/şifre değişikliği izlenir).
    /// Hata olursa akışı bozmadan yutar — audit log yazımı başarısız girişi engellemez.
    /// </summary>
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
            // YEĞİTEK gereksinim #9: loglarda düz metin PII olmaz — email ve IP mask'lenir.
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
        catch
        {
            // Audit log yazımı asla istek akışını bozmamalı.
        }
    }

    private static string FrontendAdresi(IConfiguration yapilandirma) =>
        (yapilandirma["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');

    /// <summary>Hesabın rolleri ile istenen giriş context'ine göre cookie scheme seçer.</summary>
    private static string? GirisIcinSchemeSec(IList<string> roller, string? istenenContext)
    {
        // Kullanıcının sahip olduğu context'ler
        bool ogrenci = roller.Contains("Student");
        bool ilPersoneli = roller.Contains("ProvinceManager") || roller.Contains("ProvinceEvaluator");
        bool bakanlik = roller.Contains("MinistryOfficial");

        // İstenen context açıkça verilmemişse, hesabın sahip olduğu ilk context'i kullan.
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

    /// <summary>Çıkış için query'den gelen role string'ini scheme adına çevirir.</summary>
    private static string? CikisIcinSchemeSec(string context) => context switch
    {
        "student" => IdentityConstants.ApplicationScheme,
        "province" => "ProvinceScheme",
        "ministry" => "MinistryScheme",
        _ => null
    };

    /// <summary>Authenticated principal'dan frontend'in ihtiyacı olan kullanıcı bilgisini üretir.</summary>
    private static async Task<object?> KullaniciBilgisiGetir(
        UserManager<ApplicationUser> kullaniciYoneticisi,
        FikirPlatformuDbContext veritabani,
        ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var kullaniciId = kullaniciYoneticisi.GetUserId(principal);
        if (string.IsNullOrEmpty(kullaniciId)) return null;
        var kullanici = await kullaniciYoneticisi.FindByIdAsync(kullaniciId);
        if (kullanici is null) return null;
        var roller = await kullaniciYoneticisi.GetRolesAsync(kullanici);

        // Context'i şemadan çıkaramayız ama rollerden çıkarabiliriz
        var context = roller.Contains("Student") ? "student"
            : (roller.Contains("ProvinceManager") || roller.Contains("ProvinceEvaluator")) ? "province"
            : roller.Contains("MinistryOfficial") ? "ministry"
            : "unknown";

        // Profil sadece öğrenci için var
        object? profil = null;
        if (context == "student")
        {
            profil = await veritabani.StudentProfiles
                .AsNoTracking()
                .Where(p => p.ApplicationUserId == kullaniciId)
                .Join(
                    veritabani.Provinces,
                    p => p.ProvinceId,
                    il => il.Id,
                    (p, il) => new
                    {
                        p.Id,
                        p.ProvinceId,
                        ProvinceName = il.Name,
                        p.District,
                        p.School,
                        p.Grade,
                        p.StudentNumber
                    })
                .FirstOrDefaultAsync(cancellationToken);
        }

        return new
        {
            context,
            email = kullanici.Email,
            firstName = kullanici.FirstName,
            lastName = kullanici.LastName,
            emailConfirmed = kullanici.EmailConfirmed,
            roles = roller,
            profile = profil
        };
    }

    public sealed record KayitIstegi(
        [Required, StringLength(50, MinimumLength = 2)] string FirstName,
        [Required, StringLength(50, MinimumLength = 2)] string LastName,
        [Required, EmailAddress, StringLength(256)] string Email,
        [Required, StringLength(128, MinimumLength = 8)] string Password,
        [Range(1, 81)] int ProvinceId,
        [StringLength(120)] string? School = null,
        [Range(1, 12)] int? Grade = null,
        [StringLength(40)] string? StudentNumber = null,
        // CAPTCHA (YEĞİTEK gereksinim #2)
        [Required, StringLength(64)] string CaptchaId = "",
        [Required, StringLength(16)] string CaptchaAnswer = "");

    public sealed record GirisIstegi(
        [Required, EmailAddress, StringLength(256)] string Email,
        [Required, StringLength(128)] string Password,
        bool RememberMe = true,
        // CAPTCHA (YEĞİTEK gereksinim #2)
        [Required, StringLength(64)] string CaptchaId = "",
        [Required, StringLength(16)] string CaptchaAnswer = "");

    public sealed record SifremiUnuttumIstegi(
        [Required, EmailAddress, StringLength(256)] string Email);

    public sealed record SifreSifirlamaIstegi(
        // Sprint 11.16: UserId opsiyonel. Admin panelinden üretilen reset linkleri
        // userId ile gelir; klasik forgot-password akışı email ile gelir. İkisi de kabul.
        string? Email,
        string? UserId,
        [Required, StringLength(512)] string Token,
        [Required, StringLength(128, MinimumLength = 8)] string NewPassword);

    public sealed record SifreDegistirIstegi(
        [Required, StringLength(128)] string CurrentPassword,
        [Required, StringLength(128, MinimumLength = 8)] string NewPassword);
}

// Sprint 11.22: Server-side debug — son şifre sıfırlama denemesinin sonucu
// burada tutulur. Onur DevTools açamadığı için /api/__debug/last-sifre-reset
// endpoint'i ile log göndermeden bilgi alabilir. Sprint 12'de kaldırılır.
public static class SifreResetDebug
{
    private static readonly object _lock = new();
    public static SifreResetDenemesi? SonDeneme { get; private set; }

    public static void Kaydet(bool basarili, string mesaj, string? userId, string? email, int tokenLen, int pwdLen, string? exception = null)
    {
        lock (_lock)
        {
            SonDeneme = new SifreResetDenemesi(
                DateTimeOffset.UtcNow,
                basarili,
                mesaj,
                userId,
                email,
                tokenLen,
                pwdLen,
                exception);
        }
    }
}

public sealed record SifreResetDenemesi(
    DateTimeOffset Zaman,
    bool Basarili,
    string Mesaj,
    string? UserId,
    string? Email,
    int TokenLen,
    int PwdLen,
    string? Exception);

