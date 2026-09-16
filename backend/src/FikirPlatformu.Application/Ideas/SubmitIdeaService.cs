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
        var moderation = await profanityFilter.CheckAsync(request.Content, cancellationToken);
        if (moderation.IsBlocked)
        {
            return SubmitIdeaResult.Failure(
                "Metninizde uygun olmayan bir ifade tespit edildi. Lütfen metninizi gözden geçiriniz.");
        }

        var idea = Idea.CreateDraft(
            request.StudentId,
            request.ProvinceId,
            request.CategoryId,
            request.Content,
            clock.UtcNow);

        idea.Submit(clock.UtcNow);
        await ideaRepository.AddAsync(idea, cancellationToken);

        return SubmitIdeaResult.Success(idea.Id, moderation.RequiresReview);
    }
}

public sealed record SubmitIdeaRequest(
    Guid StudentId,
    int ProvinceId,
    int CategoryId,
    string Content);

public sealed record SubmitIdeaResult(
    bool IsSuccess,
    Guid? IdeaId,
    bool RequiresReview,
    string? Error)
{
    public static SubmitIdeaResult Success(Guid ideaId, bool requiresReview) =>
        new(true, ideaId, requiresReview, null);

    public static SubmitIdeaResult Failure(string error) =>
        new(false, null, false, error);
}
