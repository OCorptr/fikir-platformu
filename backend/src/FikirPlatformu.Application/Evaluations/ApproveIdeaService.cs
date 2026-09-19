using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;

namespace FikirPlatformu.Application.Evaluations;

public sealed record ApproveIdeaCommand(Guid IdeaId, int ProvinceId, string ApproverUserId);

public sealed class ApproveIdeaService(
    IIdeaRepository ideaRepository,
    IClock clock)
{
    public async Task<ApproveIdeaResult> ApproveAsync(ApproveIdeaCommand komut, CancellationToken cancellationToken = default)
    {
        var fikir = await ideaRepository.GetForProvinceAsync(komut.IdeaId, komut.ProvinceId, cancellationToken);
        if (fikir is null) return new ApproveIdeaResult.NotFound();

        fikir.Approve(clock.UtcNow);
        await ideaRepository.SaveChangesAsync(cancellationToken);
        return new ApproveIdeaResult.Ok(clock.UtcNow);
    }
}

public abstract record ApproveIdeaResult
{
    public sealed record Ok(DateTimeOffset ApprovedAt) : ApproveIdeaResult;
    public sealed record NotFound : ApproveIdeaResult;
}
