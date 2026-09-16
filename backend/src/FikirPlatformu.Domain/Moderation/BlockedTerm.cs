using FikirPlatformu.Domain.Common;

namespace FikirPlatformu.Domain.Moderation;

public sealed class BlockedTerm : Entity
{
    public string Term { get; set; } = string.Empty;

    public string NormalizedTerm { get; set; } = string.Empty;

    public BlockedTermAction Action { get; set; } = BlockedTermAction.Block;

    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public enum BlockedTermAction
{
    Block = 0,
    Flag = 1
}
