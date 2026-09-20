using System.Security.Claims;
using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
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
            UserManager<ApplicationUser> kullaniciYoneticisi,
            IConfiguration yapilandirma) =>
        {
            var frontendAdresi = FrontendAdresi(yapilandirma);
            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null)
            {
                return Results.Redirect($"{frontendAdresi}/giris?verified=invalid");
            }

            var sonuc = await kullaniciYoneticisi.ConfirmEmailAsync(kullanici, token);
            return sonuc.Succeeded
                ? Results.Redirect($"{frontendAdresi}/giris?verified=success")
                : Results.Redirect($"{frontendAdresi}/giris?verified=invalid");
        });

        grup.MapPost("/login", async (
            GirisIstegi istek,
            [FromQuery] string? role,
            SignInManager<ApplicationUser> girisYoneticisi) =>
        {
            var kullanici = await girisYoneticisi.UserManager.FindByEmailAsync(istek.Email);
            if (kullanici is null)
            {
                return KimlikHatasi("E-posta veya şifre geçersiz.");
            }

            var sonuc = await girisYoneticisi.PasswordSignInAsync(
                kullanici, istek.Password, istek.RememberMe, lockoutOnFailure: true);

            if (sonuc.IsNotAllowed)
            {
                return Results.Json(new
                {
                    message = "E-posta adresiniz doğrulanmamış. Doğrulama e-postasındaki bağlantıyı kullanın."
                }, statusCode: 403);
            }

            if (sonuc.IsLockedOut)
            {
                return Results.Json(new { message = "Çok fazla hatalı deneme yapıldı. Hesabınız geçici olarak kilitlendi." }, statusCode: 423);
            }

            if (!sonuc.Succeeded)
            {
                return KimlikHatasi("E-posta veya şifre geçersiz.");
            }

            var roller = await girisYoneticisi.UserManager.GetRolesAsync(kullanici);
            var scheme = GirisIcinSchemeSec(roller, role);

            // İstenen role ile hesabın rolleri uyuşmazsa, girişi reddet — başka hesaba karışma.
            if (scheme is null)
            {
                await girisYoneticisi.SignOutAsync();
                var beklenen = role switch
                {
                    "student" => "öğrenci",
                    "province" => "il personeli",
                    "ministry" => "bakanlık",
                    _ => "bilinmeyen"
                };
                return Results.Json(new
                {
                    message = $"Bu hesap '{beklenen}' rolü için yetkili değil."
                }, statusCode: 403);
            }

            // Doğru scheme ile yeniden SignIn — ilk PasswordSignIn default scheme kullandı.
            // Identity.Application (öğrenci) cookie'sini Province/Ministry scheme'i ile değiştiriyoruz.
            if (scheme != IdentityConstants.ApplicationScheme)
            {
                await girisYoneticisi.SignOutAsync();
                await girisYoneticisi.SignInAsync(kullanici, istek.RememberMe, scheme);
            }

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
                }
            });
        });

        grup.MapPost("/logout", async (
            [FromQuery] string? role,
            HttpContext http) =>
        {
            // role belirtilmişse sadece o scheme'in cookie'sini sil;
            // belirtilmemişse tümünü sil (tüm sekmelerden çıkış).
            if (!string.IsNullOrEmpty(role))
            {
                var scheme = CikisIcinSchemeSec(role);
                if (scheme is not null)
                {
                    await http.SignOutAsync(scheme);
                    return Results.Ok(new { message = "Çıkış yapıldı.", context = role });
                }
            }
            await http.SignOutAsync(IdentityConstants.ApplicationScheme);
            await http.SignOutAsync("ProvinceScheme");
            await http.SignOutAsync("MinistryScheme");
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
            UserManager<ApplicationUser> kullaniciYoneticisi) =>
        {
            var kullanici = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
            if (kullanici is null)
            {
                return KimlikHatasi("Sıfırlama bağlantısı geçersiz.");
            }

            var sonuc = await kullaniciYoneticisi.ResetPasswordAsync(kullanici, istek.Token, istek.NewPassword);
            return sonuc.Succeeded
                ? Results.Ok(new { message = "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz." })
                : Results.ValidationProblem(sonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
        });

        return app;
    }

    private static IResult KimlikHatasi(string mesaj) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["kimlik"] = [mesaj] });

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
        string FirstName,
        string LastName,
        string Email,
        string Password,
        int ProvinceId,
        string? School = null,
        int? Grade = null,
        string? StudentNumber = null);

    public sealed record GirisIstegi(string Email, string Password, bool RememberMe = true);

    public sealed record SifremiUnuttumIstegi(string Email);

    public sealed record SifreSifirlamaIstegi(string Email, string Token, string NewPassword);
}
