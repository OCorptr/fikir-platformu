namespace FikirPlatformu.Domain.Ministry;

/// <summary>
/// Bir dönemin "Ayın Fikri" kazananı (Onur kuralı, 9 Eki 2026).
///
/// İki kademeli seçim:
///   1. İl AR-GE değerlendirmesi sonunda <b>her kategoriden en fazla 1</b> fikir
///      bakanlık adayı olarak gönderilir → <see cref="PeriodSelection"/>.
///   2. Bakanlık bu adayların içinden <b>1 tanesini</b> seçer → bu varlık.
///
/// Bir dönemde en fazla 1 kazanan olabilir (PK = PeriodId).
/// </summary>
public sealed class PeriodWinner
{
    public Guid PeriodId { get; set; }
    public Guid IdeaId { get; set; }
    public string SelectedByUserId { get; set; } = string.Empty;
    public DateTimeOffset SelectedAt { get; set; }
}