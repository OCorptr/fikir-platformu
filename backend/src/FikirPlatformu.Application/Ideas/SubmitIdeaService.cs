using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Moderation;
using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Ideas;

public sealed class SubmitIdeaService(
    IIdeaRepository ideaRepository,
    IProfanityFilter profanityFilter,
    IClock clock)
{
    public async Task<SubmitIdeaResult> SubmitAsync(
        SubmitIdeaRequest request,
        CancellationToken cancellationToken = default)
    {
        var idea = await ideaRepository.GetOwnedAsync(
            request.IdeaId,
            request.StudentId,
            cancellationToken);
        if (idea is null || idea.Status == IdeaSubmissionStatus.Deleted)
        {
            return SubmitIdeaResult.Failure(SubmitIdeaError.NotFound, "Fikir bulunamadı.");
        }

        if (idea.Status != IdeaSubmissionStatus.Draft)
        {
            return SubmitIdeaResult.Failure(
                SubmitIdeaError.NotDraft,
                "Yalnızca taslak durumundaki fikir gönderilebilir.");
        }

        if (string.IsNullOrWhiteSpace(idea.Content))
        {
            return SubmitIdeaResult.Failure(
                SubmitIdeaError.InvalidContent,
                "Fikir metni boş bırakılamaz.");
        }

        var moderation = await profanityFilter.CheckAsync(idea.Content, cancellationToken);
        if (moderation.IsBlocked)
        {
            return SubmitIdeaResult.Failure(
                SubmitIdeaError.BlockedContent,
                "Metninizde uygun olmayan bir ifade tespit edildi. Lütfen metninizi gözden geçiriniz.");
        }

        idea.Submit(request.ProvinceId, clock.UtcNow);
        await ideaRepository.SaveChangesAsync(cancellationToken);

        return SubmitIdeaResult.Success(idea.Id, moderation.RequiresReview);
    }
}

public sealed record SubmitIdeaRequest(
    Guid IdeaId,
    Guid StudentId,
    int ProvinceId);

public enum SubmitIdeaError
{
    None = 0,
    NotFound = 1,
    NotDraft = 2,
    InvalidContent = 3,
    BlockedContent = 4
}

public sealed record SubmitIdeaResult(
    bool IsSuccess,
    Guid? IdeaId,
    bool RequiresReview,
    SubmitIdeaError ErrorCode,
    string? Error)
{
    public static SubmitIdeaResult Success(Guid ideaId, bool requiresReview) =>
        new(true, ideaId, requiresReview, SubmitIdeaError.None, null);

    public static SubmitIdeaResult Failure(SubmitIdeaError errorCode, string error) =>
        new(false, null, false, errorCode, error);
}
