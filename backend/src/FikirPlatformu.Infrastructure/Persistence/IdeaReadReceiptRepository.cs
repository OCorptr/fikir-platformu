using FikirPlatformu.Application.Provinces;
using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaReadReceiptRepository(FikirPlatformuDbContext db) : IIdeaReadReceiptRepository
{
    public async Task<DateTimeOffset?> GetReadAtAsync(Guid ideaId, string userId, CancellationToken cancellationToken = default)
    {
        return await db.IdeaReadReceipts
            .Where(r => r.IdeaId == ideaId && r.UserId == userId)
            .Select(r => (DateTimeOffset?)r.ReadAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task MarkReadAsync(Guid ideaId, string userId, DateTimeOffset readAt, CancellationToken cancellationToken = default)
    {
        var existing = await db.IdeaReadReceipts
            .FirstOrDefaultAsync(r => r.IdeaId == ideaId && r.UserId == userId, cancellationToken);
        if (existing is null)
        {
            db.IdeaReadReceipts.Add(new IdeaReadReceipt
            {
                IdeaId = ideaId,
                UserId = userId,
                ReadAt = readAt,
            });
        }
        else
        {
            existing.ReadAt = readAt;
        }
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken = default) => db.SaveChangesAsync(cancellationToken);
}
