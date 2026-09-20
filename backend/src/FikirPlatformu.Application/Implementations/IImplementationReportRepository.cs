using FikirPlatformu.Domain.Implementations;

namespace FikirPlatformu.Application.Implementations;

public interface IImplementationReportRepository
{
    Task<IReadOnlyList<ImplementationReport>> GetForIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task AddAsync(ImplementationReport report, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
