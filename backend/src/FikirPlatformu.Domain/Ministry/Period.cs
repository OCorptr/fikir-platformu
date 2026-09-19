namespace FikirPlatformu.Domain.Ministry;

/// <summary>
/// Üç aylık dönem (plan §25). Her dönemde her kategoriden bir fikir seçilir (plan §26).
/// </summary>
public sealed class Period
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public PeriodStatus Status { get; set; } = PeriodStatus.Open;
    public DateTimeOffset CreatedAt { get; set; }
}
