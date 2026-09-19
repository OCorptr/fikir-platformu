using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaAssignmentRepository(FikirPlatformuDbContext db) : IIdeaAssignmentRepository
{
    public async Task<IReadOnlyList<string>> GetEvaluatorIdsAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        return await db.IdeaAssignments
            .Where(a => a.IdeaId == ideaId)
            .Select(a => a.EvaluatorUserId)
            .ToListAsync(cancellationToken);
    }

    public async Task AssignAsync(IdeaAssignment assignment, CancellationToken cancellationToken = default)
    {
        var existing = await db.IdeaAssignments
            .FirstOrDefaultAsync(a => a.IdeaId == assignment.IdeaId && a.EvaluatorUserId == assignment.EvaluatorUserId, cancellationToken);
        if (existing is null)
        {
            db.IdeaAssignments.Add(assignment);
        }
        else
        {
            existing.AssignedByUserId = assignment.AssignedByUserId;
            existing.AssignedAt = assignment.AssignedAt;
        }
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);
}
