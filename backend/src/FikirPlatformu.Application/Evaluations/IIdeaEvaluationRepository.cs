using FikirPlatformu.Domain.Evaluations;

namespace FikirPlatformu.Application.Evaluations;

public interface IIdeaEvaluationRepository
{
    Task<IReadOnlyList<Evaluation>> GetForIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Evaluation>> GetForEvaluatorAsync(string evaluatorUserId, Guid ideaId, CancellationToken cancellationToken = default);

    /// <summary>Fikir için verilen tüm puanların kriter bazında ortalaması (kriter başına evaluator ortalaması).</summary>
    Task<Dictionary<EvaluationCriterion, double>> GetAveragesAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task UpsertAsync(Evaluation evaluation, CancellationToken cancellationToken = default);

    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
