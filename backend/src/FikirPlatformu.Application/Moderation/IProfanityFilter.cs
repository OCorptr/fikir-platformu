namespace FikirPlatformu.Application.Moderation;

public interface IProfanityFilter
{
    Task<ProfanityFilterResult> CheckAsync(
        string content,
        CancellationToken cancellationToken = default);
}

public sealed record ProfanityFilterResult(bool IsBlocked, bool RequiresReview)
{
    public static ProfanityFilterResult Allowed { get; } = new(false, false);
}
