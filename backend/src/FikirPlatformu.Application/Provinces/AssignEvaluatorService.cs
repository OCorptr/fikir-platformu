using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Provinces;

public sealed record AssignEvaluatorCommand(
    Guid IdeaId,
    int ProvinceId,
    string EvaluatorUserId,
    string AssignedByUserId);

public sealed class AssignEvaluatorService(
    IIdeaRepository ideaRepository,
    IIdeaAssignmentRepository assignmentRepository,
    IClock clock)
{
    public async Task<AssignEvaluatorResult> AssignAsync(
        AssignEvaluatorCommand komut,
        CancellationToken cancellationToken = default)
    {
        var fikir = await ideaRepository.GetForProvinceAsync(komut.IdeaId, komut.ProvinceId, cancellationToken);
        if (fikir is null) return new AssignEvaluatorResult.NotFound();

        var assignment = new IdeaAssignment
        {
            IdeaId = komut.IdeaId,
            EvaluatorUserId = komut.EvaluatorUserId,
            AssignedByUserId = komut.AssignedByUserId,
            AssignedAt = clock.UtcNow,
        };
        await assignmentRepository.AssignAsync(assignment, cancellationToken);
        await assignmentRepository.SaveChangesAsync(cancellationToken);
        return new AssignEvaluatorResult.Ok(assignment.AssignedAt);
    }
}

public abstract record AssignEvaluatorResult
{
    public sealed record Ok(DateTimeOffset AssignedAt) : AssignEvaluatorResult;
    public sealed record NotFound : AssignEvaluatorResult;
}
