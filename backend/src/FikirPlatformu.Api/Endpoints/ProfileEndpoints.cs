using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/profile")
            .RequireAuthorization()
            .WithTags("Profil");

        grup.MapGet("/", async (
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HttpContext http) =>
        {
            var kullanici = await kullaniciYoneticisi.GetUserAsync(http.User);
            if (kullanici is null)
            {
                return Results.Unauthorized();
            }

            var profil = await veritabani.StudentProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.ApplicationUserId == kullanici.Id);
            var roller = await kullaniciYoneticisi.GetRolesAsync(kullanici);

            var ilAdi = profil is null
                ? null
                : await veritabani.Provinces
                    .Where(p => p.Id == profil.ProvinceId)
                    .Select(p => p.Name)
                    .FirstOrDefaultAsync();

            return Results.Ok(new
            {
                kullanici.Email,
                kullanici.FirstName,
                kullanici.LastName,
                kullanici.EmailConfirmed,
                roles = roller,
                profile = profil is null
                    ? null
                    : new
                    {
                        profil.ProvinceId,
                        provinceName = ilAdi,
                        profil.District,
                        profil.School,
                        profil.Grade,
                        profil.StudentNumber
                    }
            });
        });

        grup.MapPut("/", async (
            ProfilGuncellemeIstegi istek,
            UserManager<ApplicationUser> kullaniciYoneticisi,
            FikirPlatformuDbContext veritabani,
            HttpContext http) =>
        {
            var kullanici = await kullaniciYoneticisi.GetUserAsync(http.User);
            if (kullanici is null)
            {
                return Results.Unauthorized();
            }

            var profil = await veritabani.StudentProfiles
                .FirstOrDefaultAsync(p => p.ApplicationUserId == kullanici.Id);
            if (profil is null)
            {
                return Results.NotFound(new { message = "Profil bulunamadı." });
            }

            if (istek.ProvinceId is int ilId)
            {
                var ilVar = await veritabani.Provinces.AnyAsync(p => p.Id == ilId);
                if (!ilVar)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["provinceId"] = ["Geçerli bir il seçmelisiniz."]
                    });
                }

                profil.ProvinceId = ilId;
            }

            if (istek.District is not null) profil.District = istek.District.Trim();
            if (istek.School is not null) profil.School = istek.School.Trim();

            if (istek.Grade is not null)
            {
                if (istek.Grade is < 1 or > 12)
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["grade"] = ["Sınıf 1 ile 12 arasında olmalıdır."]
                    });
                }

                profil.Grade = istek.Grade;
            }

            if (istek.StudentNumber is not null) profil.StudentNumber = istek.StudentNumber.Trim();

            if (istek.FirstName is not null && !string.IsNullOrWhiteSpace(istek.FirstName))
            {
                kullanici.FirstName = istek.FirstName.Trim();
            }

            if (istek.LastName is not null && !string.IsNullOrWhiteSpace(istek.LastName))
            {
                kullanici.LastName = istek.LastName.Trim();
            }

            profil.UpdatedAt = DateTimeOffset.UtcNow;
            await veritabani.SaveChangesAsync(http.RequestAborted);
            await kullaniciYoneticisi.UpdateAsync(kullanici);

            return Results.Ok(new { message = "Profil güncellendi." });
        });

        return app;
    }

    public sealed record ProfilGuncellemeIstegi(
        int? ProvinceId,
        string? District,
        string? School,
        int? Grade,
        string? StudentNumber,
        string? FirstName,
        string? LastName);
}
