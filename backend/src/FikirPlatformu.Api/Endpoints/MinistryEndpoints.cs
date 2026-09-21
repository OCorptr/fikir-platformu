using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Application.Implementations;
using FikirPlatformu.Application.Ministry;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

public static class MinistryEndpoints
{
    public static IEndpointRouteBuilder MapMinistryEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/ministry").WithTags("Bakanlık");

        // GET /api/ministry/periods — dönem listesi
        grup.MapGet("/periods", async (
            IPeriodRepository repo,
            CancellationToken cancellationToken) =>
        {
            var liste = await repo.ListAsync(cancellationToken);
            return Results.Ok(liste);
        }).RequireAuthorization("MinistryOnly");

        // POST /api/ministry/periods — yeni dönem (otomatik 3 aylık)
        grup.MapPost("/periods", async (
            YeniDonemIstegi istek,
            HttpContext http,
            PeriodService service,
            CancellationToken cancellationToken) =>
        {
            var baslangic = istek.StartAt ?? DateTimeOffset.UtcNow;
            var etiket = istek.Label ?? $"Dönem {baslangic:yyyy-MM-dd}";
            var period = await service.CreateAsync(new CreatePeriodCommand(etiket, baslangic), cancellationToken);
            return Results.Created($"/api/ministry/periods/{period.Id}", period);
        }).RequireAuthorization("MinistryOnly");

        // GET /api/ministry/periods/{id}/candidates — dönem içindeki aday havuzu (kategori gruplu)
        // Bu uçta plan §26'nın "aday havuzu" kavramı kullanılır: il onaylı (Locked) fikirler.
        grup.MapGet("/periods/{id:guid}/candidates", async (
            Guid id,
            FikirPlatformuDbContext db,
            IPeriodRepository repo,
            CancellationToken cancellationToken) =>
        {
            var period = await repo.GetAsync(id, cancellationToken);
            if (period is null) return Results.NotFound();

            // Dönem içinde tüm il onaylı (Locked) + bakanlık tarafından seçilmiş (Planned) fikirler
            // (tarih filtresi ile — sadece bu dönemdeki). Planned olanlar listede "Ayın Fikri" rozeti ile kalır.
            var adaylar = await (
                from f in db.Ideas.AsNoTracking()
                where (f.Status == IdeaSubmissionStatus.Locked || f.Status == IdeaSubmissionStatus.Planned)
                    && f.SubmittedAt != null
                    && f.SubmittedAt >= period.StartAt
                    && f.SubmittedAt < period.EndAt
                join k in db.IdeaCategories.AsNoTracking() on f.CategoryId equals k.Id
                join il in db.Provinces.AsNoTracking() on f.ProvinceId equals il.Id
                orderby f.CategoryId, il.Name
                select new
                {
                    f.Id,
                    f.CategoryId,
                    CategoryName = k.Name,
                    f.ProvinceId,
                    ProvinceName = il.Name,
                    f.Content,
                    f.UpdatedAt,
                }
            ).ToListAsync(cancellationToken);

            var secimler = await repo.GetSelectionsForPeriodAsync(id, cancellationToken);
            var seciliIdeaIds = secimler.Select(s => s.IdeaId).ToHashSet();
            var seciliKategoriIds = secimler.Select(s => s.CategoryId).ToHashSet();

            // Kategoriye göre grupla, her gruba "bu kategoriden seçildi mi" bilgisini ekle
            var gruplar = adaylar
                .GroupBy(a => new { a.CategoryId, a.CategoryName })
                .Select(g => new
                {
                    categoryId = g.Key.CategoryId,
                    categoryName = g.Key.CategoryName,
                    selected = seciliKategoriIds.Contains(g.Key.CategoryId),
                    selectedIdeaId = secimler.FirstOrDefault(s => s.CategoryId == g.Key.CategoryId)?.IdeaId,
                    ideas = g.Select(a => new
                    {
                        a.Id,
                        a.ProvinceId,
                        a.ProvinceName,
                        a.Content,
                        a.UpdatedAt,
                        isLocked = true,
                        isSelected = seciliIdeaIds.Contains(a.Id),
                    }).ToList()
                })
                .ToList();

            return Results.Ok(new
            {
                period,
                categories = gruplar,
            });
        }).RequireAuthorization("MinistryOnly");

        // POST /api/ministry/periods/{id}/select — dönem/kategori için fikir seçimi
        grup.MapPost("/periods/{id:guid}/select", async (
            Guid id,
            DonemSecimIstegi istek,
            HttpContext http,
            PeriodService service,
            CancellationToken cancellationToken) =>
        {
            var userId = http.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

            var sonuc = await service.SelectAsync(id, istek.CategoryId, istek.IdeaId, userId, cancellationToken);
            return sonuc switch
            {
                SelectForPeriodResult.Ok ok => Results.Ok(new { periodId = id, categoryId = istek.CategoryId, ideaId = istek.IdeaId, selectedAt = ok.SelectedAt }),
                SelectForPeriodResult.PeriodNotFound => Results.NotFound(new { message = "Dönem bulunamadı." }),
                SelectForPeriodResult.PeriodClosed => Results.ValidationProblem(new Dictionary<string, string[]> { ["periodId"] = ["Dönem seçime kapalı."] }),
                SelectForPeriodResult.CategoryAlreadySelected => Results.ValidationProblem(new Dictionary<string, string[]> { ["categoryId"] = ["Bu kategori için zaten seçim yapılmış."] }),
                SelectForPeriodResult.IdeaNotFound => Results.NotFound(new { message = "Fikir bulunamadı." }),
                SelectForPeriodResult.IdeaNotLocked => Results.ValidationProblem(new Dictionary<string, string[]> { ["ideaId"] = ["Fikir il onaylı (Locked) olmalı."] }),
                SelectForPeriodResult.CategoryMismatch => Results.ValidationProblem(new Dictionary<string, string[]> { ["categoryId"] = ["Fikir seçilen kategoriye ait değil."] }),
                _ => Results.StatusCode(500),
            };
        }).RequireAuthorization("MinistryOnly");

        // GET /api/ministry/periods/{id}/selected — seçilen 10 fikir (özet)
        grup.MapGet("/periods/{id:guid}/selected", async (
            Guid id,
            FikirPlatformuDbContext db,
            IPeriodRepository repo,
            CancellationToken cancellationToken) =>
        {
            var period = await repo.GetAsync(id, cancellationToken);
            if (period is null) return Results.NotFound();

            var secimler = await repo.GetSelectionsForPeriodAsync(id, cancellationToken);
            if (secimler.Count == 0) return Results.Ok(new { period, selections = Array.Empty<object>() });

            var ideaIds = secimler.Select(s => s.IdeaId).ToList();
            var fikirler = await (
                from f in db.Ideas.AsNoTracking()
                where ideaIds.Contains(f.Id)
                join k in db.IdeaCategories.AsNoTracking() on f.CategoryId equals k.Id
                join il in db.Provinces.AsNoTracking() on f.ProvinceId equals il.Id
                select new
                {
                    f.Id,
                    f.CategoryId,
                    CategoryName = k.Name,
                    f.ProvinceId,
                    ProvinceName = il.Name,
                    f.Content,
                    f.UpdatedAt,
                }
            ).ToListAsync(cancellationToken);

            var sonuc = secimler.Select(s => new
            {
                s.CategoryId,
                Idea = fikirler.FirstOrDefault(f => f.Id == s.IdeaId),
                s.SelectedAt,
                s.SelectedByUserId,
            });

            return Results.Ok(new { period, selections = sonuc });
        }).RequireAuthorization("MinistryOnly");

        // GET /api/ministry/implementations — tüm Planned+Implementation fikirler (özet ekranı, plan §30)
        grup.MapGet("/implementations", async (
            IImplementationSummaryQueryService service,
            CancellationToken cancellationToken) =>
        {
            var liste = await service.ListAllAsync(cancellationToken);
            return Results.Ok(liste);
        }).RequireAuthorization("MinistryOnly");

        return app;
    }

    public sealed record YeniDonemIstegi(DateTimeOffset? StartAt, string? Label);
    public sealed record DonemSecimIstegi(int CategoryId, Guid IdeaId);
}
