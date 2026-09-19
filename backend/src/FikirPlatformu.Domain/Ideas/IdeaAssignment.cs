namespace FikirPlatformu.Domain.Ideas;

/// <summary>
/// İl AR-GE yöneticisinin (ProvinceManager) bir fikri belirli bir değerlendiriciye atamasını tutar.
/// Plan §14.1: sorumluluk atanır, devir yapılabilir.
/// </summary>
public sealed class IdeaAssignment
{
    public Guid IdeaId { get; set; }
    public string EvaluatorUserId { get; set; } = string.Empty;
    public string AssignedByUserId { get; set; } = string.Empty;
    public DateTimeOffset AssignedAt { get; set; }
}
