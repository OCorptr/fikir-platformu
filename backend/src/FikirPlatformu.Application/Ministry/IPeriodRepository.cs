using FikirPlatformu.Domain.Ministry;

namespace FikirPlatformu.Application.Ministry;

public interface IPeriodRepository
{
    Task<IReadOnlyList<Period>> ListAsync(CancellationToken cancellationToken = default);

    Task<Period?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<PeriodSelection?> GetSelectionAsync(Guid periodId, int categoryId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PeriodSelection>> GetSelectionsForPeriodAsync(Guid periodId, CancellationToken cancellationToken = default);

    Task<bool> CategoryHasSelectionAsync(Guid periodId, int categoryId, CancellationToken cancellationToken = default);

    Task AddAsync(Period period, CancellationToken cancellationToken = default);

    Task AddSelectionAsync(PeriodSelection selection, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
