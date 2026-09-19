namespace FikirPlatformu.Domain.Evaluations;

/// <summary>
/// Bir evaluator'ün bir fikre verdiği tek kriter puanı + yorum.
/// Birden fazla criterion + birden fazla evaluator için ayrı satır (plan §20).
/// </summary>
public sealed class Evaluation
{
    public Guid IdeaId { get; set; }
    public string EvaluatorUserId { get; set; } = string.Empty;
    public EvaluationCriterion Criterion { get; set; }
    /// <summary>1–5 arası (plan §20 varsayılan).</summary>
    public int Score { get; set; }
    public string? Comment { get; set; }
    public DateTimeOffset EvaluatedAt { get; set; }
}
