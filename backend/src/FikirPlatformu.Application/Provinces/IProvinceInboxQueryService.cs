namespace FikirPlatformu.Application.Provinces;

public sealed record InboxEntry(
    Guid IdeaId,
    int CategoryId,
    string CategoryName,
    int ProvinceId,
    string ProvinceName,
    string Content,
    DateTimeOffset SubmittedAt,
    string StudentFirstName,
    string StudentLastName,
    string? StudentSchool,
    int? StudentGrade,
    string? StudentNumber,
    IReadOnlyList<string> AssignedEvaluatorUserIds,
    bool IsReadByMe,
    DateTimeOffset? ReadAtByMe,
    int EvaluationCount,
    DateTimeOffset? LastEvaluatedAt,
    double? AverageScore,
    bool IsMinistrySelected,
    /// <summary>
    /// Sprint 11.92: fikrin durumu. Gelen kutusunda "Hayata Geçir" butonu
    /// yalnızca il onaylı (Locked) ve henüz uygulamaya geçmemiş fikirlerde
    /// görünür.
    /// </summary>
    FikirPlatformu.Domain.Ideas.IdeaSubmissionStatus Status);

/// <summary>
/// Sprint 11.92 (Onur): "Puanlama yapıldığı anda Gelen Fikirler kısmında değil de
/// Raporlama kısmında sadece olmalı ve Gelen Fikirler kısmından çıkmalı, yoksa
/// Gelen Fikirler kısmı gereksiz dolacak hep."
/// </summary>
public enum InboxAsama
{
    /// <summary>Yalnızca puanlanmamış / puanlanmakta olan fikirler (Submitted, InEvaluation).</summary>
    Gelen = 0,

    /// <summary>
    /// Puanlaması tamamlanmış ve sonrası (EvaluationCompleted, Locked, Planned,
    /// uygulama durumları). Yönetici kararının verildiği yer.
    /// </summary>
    Kararli = 1,
}

public interface IProvinceInboxQueryService
{
    /// <param name="provinceId">
    /// Onur (S11.74): <c>null</c> → il filtresi yok, TÜM iller listelenir
    /// (sistem yöneticisi istisnadır). Personel için kendi ili atanır.
    /// </param>
    /// <param name="asama">Hangi aşama listelenecek (varsayılan: Gelen).</param>
    Task<IReadOnlyList<InboxEntry>> ListAsync(
        int? provinceId,
        string currentUserId,
        InboxAsama asama = InboxAsama.Gelen,
        CancellationToken cancellationToken = default);
}
