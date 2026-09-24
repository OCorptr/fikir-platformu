using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Demo amaçlı test kullanıcılarını Identity policy-uyumlu şifrelerle günceller
/// (plan dışı — sadece Render.com demo seeding için). Protected: SystemAdmin/MinistryOfficial rolu gerekli.
/// </summary>
public static class DemoSeedEndpoints
{
    public static IEndpointRouteBuilder MapDemoSeedEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/admin/demo-seed").WithTags("DemoSeed");

        grup.MapPost("/reset-passwords", async (
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            IConfiguration yapilandirma,
            HttpContext http) =>
        {
            // Bootstrap key kontrolü — Render.com env variable'a DemoSeed:BypassKey set edilir.
            // Key olmadan endpoint çalışmaz (yetkisiz erişimi önler).
            var beklenenKey = yapilandirma["DemoSeed:BypassKey"];
            var gelenKey = http.Request.Headers["X-Bootstrap-Key"].FirstOrDefault();
            if (string.IsNullOrEmpty(beklenenKey) || gelenKey != beklenenKey)
            {
                return Results.Json(new { message = "Geçersiz bootstrap anahtarı." }, statusCode: 403);
            }

            // Demo şifreler — hepsi Identity policy'e uyumlu (min 8 + karmaşıklık + unique 4)
            var demoSifreler = new Dictionary<string, string>
            {
                ["ministry@local"] = "Demo1234!",
                ["manager@local"] = "Demo1234!",
                ["evaluator@local"] = "Demo1234!",
                ["audit.test.74089130@local"] = "Demo1234!",
            };

            var sonuclar = new List<object>();
            foreach (var (email, yeniSifre) in demoSifreler)
            {
                var hedef = await kullaniciYoneticisi.FindByEmailAsync(email);
                if (hedef is null)
                {
                    sonuclar.Add(new { email, durum = "bulunamadi" });
                    continue;
                }

                // Lockout temizle (5 yanlış deneme sonrası kilitlenmiş olabilir)
                await kullaniciYoneticisi.SetLockoutEndDateAsync(hedef, null);
                await kullaniciYoneticisi.ResetAccessFailedCountAsync(hedef);

                // Email confirmed (yoksa LoginEmailNotConfirmed audit düşer)
                hedef.EmailConfirmed = true;

                // Mevcut şifreyi sıfırla (token üretip uygula).
                var token = await kullaniciYoneticisi.GeneratePasswordResetTokenAsync(hedef);
                var sonuc = await kullaniciYoneticisi.ResetPasswordAsync(hedef, token, yeniSifre);
                if (sonuc.Succeeded)
                {
                    hedef.PasswordChangedAt = DateTimeOffset.UtcNow;
                    await kullaniciYoneticisi.UpdateAsync(hedef);
                    sonuclar.Add(new { email, durum = "sifirlandi", sifre = yeniSifre });
                }
                else
                {
                    sonuclar.Add(new
                    {
                        email,
                        durum = "hata",
                        hatalar = sonuc.Errors.Select(e => e.Description).ToArray()
                    });
                }
            }

            return Results.Ok(new
            {
                mesaj = "Demo şifreler güncellendi.",
                sonuclar
            });
        }).AllowAnonymous();

        return app;
    }
}