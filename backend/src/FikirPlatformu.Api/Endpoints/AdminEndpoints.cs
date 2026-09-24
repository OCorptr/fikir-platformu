using System.ComponentModel.DataAnnotations;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Sistem yöneticisi (SystemAdmin) endpoint'leri (Sprint 9).
/// Tüm endpoint'ler "SystemAdminOnly" policy ile korunuyor: MFA doğrulanmış + SystemAdmin rolü.
/// - POST /api/admin/users: yeni kullanıcı oluştur (rol atanır, MFA zorunluysa zorla)
/// - GET /api/admin/users: kullanıcı listesi (filtre: rol, sayfalama)
/// </summary>
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/admin").WithTags("Sistem Yönetimi");

        // 1) Yeni kullanıcı oluştur (Sprint 9).
        grup.MapPost("/users", async (
            YeniKullaniciIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HttpContext http) =>
        {
            // Rol whitelist: Sistem yöneticisi sadece bu rolleri atayabilir.
            var izinliRoller = new[] { "SystemAdmin", "MinistryOfficial", "ProvinceManager", "ProvinceEvaluator" };
            if (!izinliRoller.Contains(istek.Role))
            {
                return Results.Json(new
                {
                    message = $"Geçersiz rol. İzinli roller: {string.Join(", ", izinliRoller)}"
                }, statusCode: 400);
            }

            // Email benzersizlik kontrolü.
            var mevcut = await kullaniciYoneticisi.FindByEmailAsync(istek.Email);
            if (mevcut is not null)
            {
                return Results.Json(new { message = "Bu e-posta adresi zaten kullanılıyor." }, statusCode: 409);
            }

            var kullanici = new ApplicationUser
            {
                UserName = istek.Email,
                Email = istek.Email,
                FirstName = istek.FirstName.Trim(),
                LastName = istek.LastName.Trim(),
                EmailConfirmed = true, // Admin tarafından oluşturulan kullanıcı için e-posta onaylı kabul.
                MustChangePassword = true, // İlk girişte şifre değiştirme zorunlu.
                PasswordChangedAt = DateTimeOffset.UtcNow
            };

            var sonuc = await kullaniciYoneticisi.CreateAsync(kullanici, istek.Password);
            if (!sonuc.Succeeded)
            {
                return Results.ValidationProblem(sonuc.Errors
                    .GroupBy(e => e.Code)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
            }

            await kullaniciYoneticisi.AddToRoleAsync(kullanici, istek.Role);

            // Audit log.
            veritabani.AuthEvents.Add(new Domain.Auth.AuthEvent
            {
                Id = Guid.NewGuid(),
                UserId = kullanici.Id,
                Email = KisiselVeriYardimci.EmailMaskele(kullanici.Email),
                IpAddress = KisiselVeriYardimci.IpMaskele(http.Connection.RemoteIpAddress?.ToString()),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                EventType = Domain.Auth.AuthEventType.UserCreated,
                Success = true,
                FailureReason = $"role={istek.Role}",
                CreatedAt = DateTime.UtcNow
            });
            await veritabani.SaveChangesAsync(http.RequestAborted);

            return Results.Json(new
            {
                message = "Kullanıcı oluşturuldu.",
                userId = kullanici.Id,
                email = kullanici.Email,
                role = istek.Role,
                mfaSetupRequired = true // Privileged roller için MFA kurulumu zorunlu.
            }, statusCode: 201);
        }).RequireAuthorization("SystemAdminOnly");

        // 2) Kullanıcı listesi (Sprint 9).
        grup.MapGet("/users", async (
            string? role,
            int sayfa,
            int sayfaBasina,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani) =>
        {
            sayfa = sayfa <= 0 ? 1 : sayfa;
            sayfaBasina = sayfaBasina <= 0 || sayfaBasina > 100 ? 25 : sayfaBasina;

            // Rol filtresi için rol-UserId eşlemesini önceden çekip in-memory filtre uygula
            // (EF Core LINQ navigation property default gelmiyor; küçük ölçekli sistem için yeterli).
            IReadOnlyCollection<string>? rolUserIds = null;
            if (!string.IsNullOrWhiteSpace(role))
            {
                var hedefRolId = await veritabani.Roles
                    .Where(r => r.Name == role)
                    .Select(r => r.Id)
                    .FirstOrDefaultAsync();
                if (hedefRolId is null)
                {
                    return Results.Ok(new { toplam = 0, sayfa, sayfaBasina, kullanicilar = Array.Empty<object>() });
                }
                rolUserIds = await veritabani.Set<IdentityUserRole<string>>()
                    .Where(ur => ur.RoleId == hedefRolId)
                    .Select(ur => ur.UserId)
                    .ToListAsync();
            }

            var sorgu = kullaniciYoneticisi.Users.AsQueryable();
            if (rolUserIds is not null)
            {
                var ids = rolUserIds; // closure için yerel değişkene al
                sorgu = sorgu.Where(u => ids.Contains(u.Id));
            }

            var toplam = await sorgu.CountAsync();
            var liste = await sorgu
                .OrderBy(u => u.Email)
                .Skip((sayfa - 1) * sayfaBasina)
                .Take(sayfaBasina)
                .Select(u => new
                {
                    u.Id,
                    u.Email,
                    u.FirstName,
                    u.LastName,
                    u.TwoFactorEnabled,
                    u.MustChangePassword,
                    u.EmailConfirmed,
                    u.LockoutEnabled
                })
                .ToListAsync();

            return Results.Ok(new
            {
                toplam,
                sayfa,
                sayfaBasina,
                kullanicilar = liste
            });
        }).RequireAuthorization("SystemAdminOnly");

        return app;
    }

    public sealed record YeniKullaniciIstegi(
        [Required, EmailAddress, StringLength(256)] string Email,
        [Required, StringLength(100, MinimumLength = 8)] string Password,
        [Required, StringLength(50, MinimumLength = 2)] string FirstName,
        [Required, StringLength(50, MinimumLength = 2)] string LastName,
        [Required] string Role);
}
