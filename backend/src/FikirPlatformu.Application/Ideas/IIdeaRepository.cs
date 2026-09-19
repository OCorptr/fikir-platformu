using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Ideas;

public interface IIdeaRepository
{
    Task<Idea?> GetOwnedAsync(
        Guid ideaId,
        Guid studentId,
        CancellationToken cancellationToken = default);

    Task<Idea?> GetForProvinceAsync(
        Guid ideaId,
        int provinceId,
        CancellationToken cancellationToken = default);

    Task<Idea?> GetForAnyProvinceAsync(
        Guid ideaId,
        CancellationToken cancellationToken = default);

    Task AddAsync(Idea idea, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
