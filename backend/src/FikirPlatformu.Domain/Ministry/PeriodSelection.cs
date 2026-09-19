namespace FikirPlatformu.Domain.Ministry;

/// <summary>
/// Bir dönemde bir kategori için seçilen fikir (plan §26).
/// Bir dönemde her kategoriden en fazla 1 seçim (UNIQUE kısıt).
/// </summary>
public sealed class PeriodSelection
{
    public Guid PeriodId { get; set; }
    public int CategoryId { get; set; }
    public Guid IdeaId { get; set; }
    public string SelectedByUserId { get; set; } = string.Empty;
    public DateTimeOffset SelectedAt { get; set; }
}
