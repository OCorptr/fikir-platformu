using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class ReferenceEndpoints
{
    public static IEndpointRouteBuilder MapReferenceEndpoints(this IEndpointRouteBuilder app)
    {
        // Sprint 11.92: fail-closed politikası nedeniyle açık işaretlenir
        // (il/kategori listesi kayıt ekranında, giriş yapmadan kullanılıyor).
        var grup = app.MapGroup("/api/reference").WithTags("Referans").AllowAnonymous();

        grup.MapGet("/provinces", async (FikirPlatformuDbContext veritabani) =>
        {
            var iller = await veritabani.Provinces
                .OrderBy(p => p.Id)
                .Select(p => new { p.Id, p.Name })
                .ToListAsync();
            return Results.Ok(iller);
        });

        grup.MapGet("/categories", async (FikirPlatformuDbContext veritabani) =>
        {
            var kategoriler = await veritabani.IdeaCategories
                .Where(c => c.IsActive)
                .OrderBy(c => c.Id)
                .Select(c => new { c.Id, c.Name })
                .ToListAsync();
            return Results.Ok(kategoriler);
        });

        return app;
    }
}
