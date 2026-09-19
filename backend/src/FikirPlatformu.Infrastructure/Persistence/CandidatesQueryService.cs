using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed record CandidateSummary(
    Guid IdeaId,
    int CategoryId,
    string CategoryName,
    string Content,
    double AverageScore,
    DateTimeOffset CompletedAt);

public interface ICandidatesQueryService
{
    Task<IReadOnlyList<CandidateSummary>> ListAsync(int provinceId, CancellationToken cancellationToken = default);
}

public sealed class CandidatesQueryService(FikirPlatformuDbContext db) : ICandidatesQueryService
{
    public async Task<IReadOnlyList<CandidateSummary>> ListAsync(int provinceId, CancellationToken cancellationToken = default)
    {
        // Aday havuzu: EvaluationCompleted durumundaki fikirler, ortalama puan eşik üstü.
        var fikirler = await (
            from f in db.Ideas.AsNoTracking()
            where f.ProvinceId == provinceId && f.Status == IdeaSubmissionStatus.EvaluationCompleted
            join k in db.IdeaCategories.AsNoTracking() on f.CategoryId equals k.Id
            orderby f.UpdatedAt descending
            select new
            {
                f.Id,
                f.CategoryId,
                CategoryName = k.Name,
                f.Content,
                f.UpdatedAt,
            }
        ).ToListAsync(cancellationToken);

        if (fikirler.Count == 0) return Array.Empty<CandidateSummary>();

        var ideaIds = fikirler.Select(f => f.Id).ToList();
        var ortalamalar = await db.Evaluations
            .AsNoTracking()
            .Where(e => ideaIds.Contains(e.IdeaId))
            .GroupBy(e => e.IdeaId)
            .Select(g => new { IdeaId = g.Key, Avg = g.Average(e => (double)e.Score) })
            .ToListAsync(cancellationToken);

        var ortMap = ortalamalar.ToDictionary(o => o.IdeaId, o => o.Avg);
        return fikirler
            .Where(f => ortMap.TryGetValue(f.Id, out var avg) && avg >= SubmitEvaluationService.CandidateThreshold)
            .Select(f => new CandidateSummary(
                f.Id,
                f.CategoryId,
                f.CategoryName,
                f.Content,
                ortMap[f.Id],
                f.UpdatedAt))
            .ToList();
    }
}
