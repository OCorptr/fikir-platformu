using FikirPlatformu.Application.Implementations;
using FikirPlatformu.Domain.Implementations;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class ImplementationReportRepository(FikirPlatformuDbContext db) : IImplementationReportRepository
{
    public async Task<IReadOnlyList<ImplementationReport>> GetForIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default)
    {
        return await db.ImplementationReports
            .AsNoTracking()
            .Where(r => r.IdeaId == ideaId)
            .OrderByDescending(r => r.ReportedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(ImplementationReport report, CancellationToken cancellationToken = default)
    {
        await db.ImplementationReports.AddAsync(report, cancellationToken);
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);
}
