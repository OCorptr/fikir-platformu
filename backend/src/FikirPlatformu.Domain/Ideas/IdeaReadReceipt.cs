namespace FikirPlatformu.Domain.Ideas;

/// <summary>
/// Bir kullanıcının (il sorumlusu veya yöneticisi) belirli bir fikri okuduğunu belirten kayıt.
/// Plan §13.2: okunma bilgisi kullanıcı bazında ayrı tabloda tutulur.
/// </summary>
public sealed class IdeaReadReceipt
{
    public Guid IdeaId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTimeOffset ReadAt { get; set; }
}
