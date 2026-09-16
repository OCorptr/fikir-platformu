using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
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
            UserManager<ApplicationUser> kullaniciYoneticisi) =>
        {
            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null)
            {
                return Results.Content("<p>Doğrulama bağlantısı geçersiz.</p>", "text/html; charset=utf-8");
            }

            var sonuc = await kullaniciYoneticisi.ConfirmEmailAsync(kullanici, token);
            return sonuc.Succeeded
                ? Results.Content("<h1>E-posta adresiniz doğrulandı</h1><p>Artık giriş yapabilirsiniz.</p>", "text/html; charset=utf-8")
                : Results.Content("<p>Doğrulama bağlantısı geçersiz veya süresi dolmuş.</p>", "text/html; charset=utf-8");
        });

        grup.MapPost("/login", async (
            GirisIstegi istek,
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
            return Results.Ok(new
            {
                kullanici.Email,
                kullanici.FirstName,
                kullanici.LastName,
                roles = roller
            });
        });

        grup.MapPost("/logout", async (SignInManager<ApplicationUser> girisYoneticisi) =>
        {
            await girisYoneticisi.SignOutAsync();
            return Results.Ok(new { message = "Çıkış yapıldı." });
        });

        grup.MapPost("/forgot-password", async (
            SifremiUnuttumIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            IEmailSender epostaGonderici,
            HttpContext http) =>
        {
            var kullanici = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
            if (kullanici is not null)
            {
                var belirtec = await kullaniciYoneticisi.GeneratePasswordResetTokenAsync(kullanici);
                var sifirlamaBaglantisi = $"{http.Request.Scheme}://{http.Request.Host}/api/auth/reset-password"
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

    public sealed record KayitIstegi(
        string FirstName,
        string LastName,
        string Email,
        string Password,
        int ProvinceId);

    public sealed record GirisIstegi(string Email, string Password, bool RememberMe = true);

    public sealed record SifremiUnuttumIstegi(string Email);

    public sealed record SifreSifirlamaIstegi(string Email, string Token, string NewPassword);
}
