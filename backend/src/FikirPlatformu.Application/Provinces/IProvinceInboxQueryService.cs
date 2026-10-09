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

public interface IProvinceInboxQueryService
{
    /// <param name="provinceId">
    /// Onur (S11.74): <c>null</c> → il filtresi yok, TÜM iller listelenir
    /// (sistem yöneticisi istisnadır). Personel için kendi ili atanır.
    /// </param>
    Task<IReadOnlyList<InboxEntry>> ListAsync(
        int? provinceId,
        string currentUserId,
        CancellationToken cancellationToken = default);
}
