using FikirPlatformu.Domain.Implementations;

namespace FikirPlatformu.Application.Implementations;

public sealed record ImplementationSummary(
    Guid IdeaId,
    int CategoryId,
    string CategoryName,
    int ProvinceId,
    string ProvinceName,
    string Content,
    IdeaStatusSnapshot Status,
    DateTimeOffset UpdatedAt);

public sealed record IdeaStatusSnapshot(string Status, string PeriodLabel);

public interface IImplementationSummaryQueryService
{
    Task<IReadOnlyList<ImplementationSummary>> ListAllAsync(CancellationToken cancellationToken = default);
}
