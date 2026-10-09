namespace FikirPlatformu.Domain.Implementations;

/// <summary>
/// İl AR-GE yöneticisinin bir fikir için uygulama raporu (plan §28-29).
/// Her rapor ayrı satır — geçmiş takibi için (status değişimi + not).
/// </summary>
public sealed class ImplementationReport
{
    public Guid Id { get; set; }
    public Guid IdeaId { get; set; }
    public ImplementationStatus Status { get; set; }
    public string Note { get; set; } = string.Empty;

    /// <summary>
    /// Sprint 11.92 (Onur): fikir ayın fikri seçilmeden de hayata geçirilebiliyor —
    /// okulun hâlihazırda yürüttüğü bir proje kapsamında paralel uygulanıyor.
    /// Bu alan o ilişkiyi yazıyor: "2026-2027 Okul Bahçesi Yenileme Projesi
    /// kapsamında yürütülmektedir." Opsiyoneldir.
    /// </summary>
    public string? RelatedProject { get; set; }

    public string ReportedByUserId { get; set; } = string.Empty;
    public DateTimeOffset ReportedAt { get; set; }
}
