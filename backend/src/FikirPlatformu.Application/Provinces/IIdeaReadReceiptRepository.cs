using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Provinces;

public interface IIdeaReadReceiptRepository
{
    /// <summary>Bu fikri bu kullanıcı daha önce okuduysa ReadAt döner; yoksa null.</summary>
    Task<DateTimeOffset?> GetReadAtAsync(Guid ideaId, string userId, CancellationToken cancellationToken = default);

    Task MarkReadAsync(Guid ideaId, string userId, DateTimeOffset readAt, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
