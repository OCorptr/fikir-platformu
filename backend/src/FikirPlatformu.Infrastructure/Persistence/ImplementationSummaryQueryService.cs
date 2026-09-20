using FikirPlatformu.Application.Implementations;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Ministry;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class ImplementationSummaryQueryService(FikirPlatformuDbContext db) : IImplementationSummaryQueryService
{
    public async Task<IReadOnlyList<ImplementationSummary>> ListAllAsync(CancellationToken cancellationToken = default)
    {
        // Plan §30: Bakanlık özet ekranı — tüm Planned + Implementation* fikirler.
        var fikirler = await (
            from f in db.Ideas.AsNoTracking()
            where f.Status == IdeaSubmissionStatus.Planned
                || f.Status == IdeaSubmissionStatus.ImplementationInProgress
                || f.Status == IdeaSubmissionStatus.ImplementationCompleted
                || f.Status == IdeaSubmissionStatus.ImplementationFailed
            join k in db.IdeaCategories.AsNoTracking() on f.CategoryId equals k.Id
            join il in db.Provinces.AsNoTracking() on f.ProvinceId equals il.Id
            join secim in db.PeriodSelections.AsNoTracking() on f.Id equals secim.IdeaId into sc
            from secim in sc.DefaultIfEmpty()
            join period in db.Periods.AsNoTracking() on (secim != null ? secim.PeriodId : Guid.Empty) equals period.Id into pj
            from period in pj.DefaultIfEmpty()
            orderby f.UpdatedAt descending
            select new
            {
                f.Id,
                f.CategoryId,
                CategoryName = k.Name,
                f.ProvinceId,
                ProvinceName = il.Name,
                f.Content,
                f.UpdatedAt,
                f.Status,
                PeriodLabel = period != null ? period.Label : null,
            }
        ).ToListAsync(cancellationToken);

        return fikirler.Select(f => new ImplementationSummary(
            f.Id,
            f.CategoryId,
            f.CategoryName,
            f.ProvinceId,
            f.ProvinceName,
            f.Content,
            new IdeaStatusSnapshot(f.Status.ToString(), f.PeriodLabel ?? "—"),
            f.UpdatedAt)).ToList();
    }
}
