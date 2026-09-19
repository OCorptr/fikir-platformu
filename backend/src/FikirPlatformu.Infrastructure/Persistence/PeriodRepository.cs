using FikirPlatformu.Application.Ministry;
using FikirPlatformu.Domain.Ministry;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class PeriodRepository(FikirPlatformuDbContext db) : IPeriodRepository
{
    public async Task<IReadOnlyList<Period>> ListAsync(CancellationToken cancellationToken = default)
    {
        return await db.Periods
            .AsNoTracking()
            .OrderByDescending(p => p.StartAt)
            .ToListAsync(cancellationToken);
    }

    public Task<Period?> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return db.Periods.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
    }

    public Task<PeriodSelection?> GetSelectionAsync(Guid periodId, int categoryId, CancellationToken cancellationToken = default)
    {
        return db.PeriodSelections
            .FirstOrDefaultAsync(s => s.PeriodId == periodId && s.CategoryId == categoryId, cancellationToken);
    }

    public async Task<IReadOnlyList<PeriodSelection>> GetSelectionsForPeriodAsync(Guid periodId, CancellationToken cancellationToken = default)
    {
        return await db.PeriodSelections
            .AsNoTracking()
            .Where(s => s.PeriodId == periodId)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> CategoryHasSelectionAsync(Guid periodId, int categoryId, CancellationToken cancellationToken = default)
    {
        return await db.PeriodSelections
            .AnyAsync(s => s.PeriodId == periodId && s.CategoryId == categoryId, cancellationToken);
    }

    public async Task AddAsync(Period period, CancellationToken cancellationToken = default)
    {
        await db.Periods.AddAsync(period, cancellationToken);
    }

    public async Task AddSelectionAsync(PeriodSelection selection, CancellationToken cancellationToken = default)
    {
        await db.PeriodSelections.AddAsync(selection, cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);
}
