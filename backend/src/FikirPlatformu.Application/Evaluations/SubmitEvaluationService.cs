using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Evaluations;

public sealed record EvaluationScoreInput(EvaluationCriterion Criterion, int Score, string? Comment);

public sealed record SubmitEvaluationCommand(
    Guid IdeaId,
    int ProvinceId,
    string EvaluatorUserId,
    IReadOnlyList<EvaluationScoreInput> Scores);

public sealed class SubmitEvaluationService(
    IIdeaRepository ideaRepository,
    IIdeaEvaluationRepository evaluationRepository,
    IClock clock)
{
    /// <summary>Adaylık eşiği (plan §22, §37 açık). 0–5 arası ortalama.</summary>
    public const double CandidateThreshold = 3.5;

    public async Task<SubmitEvaluationResult> SubmitAsync(SubmitEvaluationCommand komut, CancellationToken cancellationToken = default)
    {
        var fikir = await ideaRepository.GetForProvinceAsync(komut.IdeaId, komut.ProvinceId, cancellationToken);
        if (fikir is null) return new SubmitEvaluationResult.NotFound();
        if (fikir.Status == IdeaSubmissionStatus.Locked) return new SubmitEvaluationResult.Locked();

        // Validasyon: 1..5 arası puan, en az 1 kriter
        if (komut.Scores.Count == 0) return new SubmitEvaluationResult.NoScores();
        if (komut.Scores.Any(s => s.Score < 1 || s.Score > 5))
            return new SubmitEvaluationResult.InvalidScore();

        // Upsert: aynı evaluator aynı kriter için birden fazla puan veremez; son yazan kazanır.
        foreach (var s in komut.Scores)
        {
            await evaluationRepository.UpsertAsync(new Evaluation
            {
                IdeaId = komut.IdeaId,
                EvaluatorUserId = komut.EvaluatorUserId,
                Criterion = s.Criterion,
                Score = s.Score,
                Comment = s.Comment,
                EvaluatedAt = clock.UtcNow,
            }, cancellationToken);
        }
        await evaluationRepository.SaveChangesAsync(cancellationToken);

        // Durum geçişi: ilk puanlama → InEvaluation; eşiği geçtiyse → EvaluationCompleted.
        if (fikir.Status == IdeaSubmissionStatus.Submitted)
        {
            fikir.MoveToInEvaluation(clock.UtcNow);
            await ideaRepository.SaveChangesAsync(cancellationToken);
        }

        var ortalamalar = await evaluationRepository.GetAveragesAsync(komut.IdeaId, cancellationToken);
        if (ortalamalar.Count > 0)
        {
            var genelOrtalama = ortalamalar.Values.Average();
            if (genelOrtalama >= CandidateThreshold && fikir.Status == IdeaSubmissionStatus.InEvaluation)
            {
                fikir.CompleteEvaluation(clock.UtcNow);
                await ideaRepository.SaveChangesAsync(cancellationToken);
            }
        }

        return new SubmitEvaluationResult.Ok(clock.UtcNow);
    }
}

public abstract record SubmitEvaluationResult
{
    public sealed record Ok(DateTimeOffset EvaluatedAt) : SubmitEvaluationResult;
    public sealed record NotFound : SubmitEvaluationResult;
    public sealed record Locked : SubmitEvaluationResult;
    public sealed record NoScores : SubmitEvaluationResult;
    public sealed record InvalidScore : SubmitEvaluationResult;
}
