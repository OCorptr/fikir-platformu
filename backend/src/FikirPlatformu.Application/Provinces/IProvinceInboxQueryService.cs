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
    DateTimeOffset? LastEvaluatedAt);

public interface IProvinceInboxQueryService
{
    Task<IReadOnlyList<InboxEntry>> ListAsync(
        int provinceId,
        string currentUserId,
        CancellationToken cancellationToken = default);
}
