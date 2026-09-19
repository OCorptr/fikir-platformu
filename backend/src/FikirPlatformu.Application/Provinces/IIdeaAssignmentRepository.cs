using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Provinces;

public interface IIdeaAssignmentRepository
{
    Task<IReadOnlyList<string>> GetEvaluatorIdsAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task AssignAsync(IdeaAssignment assignment, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
