using FikirPlatformu.Application.Evaluations;
using FikirPlatformu.Domain.Evaluations;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaEvaluationRepository(FikirPlatformuDbContext db) : IIdeaEvaluationRepository
{
    public async Task<IReadOnlyList<Evaluation>> GetForIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        return await db.Evaluations
            .AsNoTracking()
            .Where(e => e.IdeaId == ideaId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Evaluation>> GetForEvaluatorAsync(string evaluatorUserId, Guid ideaId, CancellationToken cancellationToken = default)
    {
        return await db.Evaluations
            .AsNoTracking()
            .Where(e => e.EvaluatorUserId == evaluatorUserId && e.IdeaId == ideaId)
            .ToListAsync(cancellationToken);
    }

    public async Task<Dictionary<EvaluationCriterion, double>> GetAveragesAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        var gruplar = await db.Evaluations
            .AsNoTracking()
            .Where(e => e.IdeaId == ideaId)
            .GroupBy(e => e.Criterion)
            .Select(g => new { Criterion = g.Key, Avg = g.Average(e => (double)e.Score) })
            .ToListAsync(cancellationToken);
        return gruplar.ToDictionary(g => g.Criterion, g => g.Avg);
    }

    public async Task UpsertAsync(Evaluation evaluation, CancellationToken cancellationToken = default)
    {
        var existing = await db.Evaluations
            .FirstOrDefaultAsync(e => e.IdeaId == evaluation.IdeaId
                && e.EvaluatorUserId == evaluation.EvaluatorUserId
                && e.Criterion == evaluation.Criterion, cancellationToken);
        if (existing is null)
        {
            await db.Evaluations.AddAsync(evaluation, cancellationToken);
        }
        else
        {
            existing.Score = evaluation.Score;
            existing.Comment = evaluation.Comment;
            existing.EvaluatedAt = evaluation.EvaluatedAt;
        }
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);
}
