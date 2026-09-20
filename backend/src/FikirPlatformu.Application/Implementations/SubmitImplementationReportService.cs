using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Implementations;

namespace FikirPlatformu.Application.Implementations;

public sealed record SubmitImplementationReportCommand(
    Guid IdeaId,
    int ProvinceId,
    ImplementationStatus Status,
    string Note,
    string ReportedByUserId);

public sealed class SubmitImplementationReportService(
    IIdeaRepository ideaRepository,
    IImplementationReportRepository reportRepository,
    IClock clock)
{
    public async Task<SubmitImplementationReportResult> SubmitAsync(
        SubmitImplementationReportCommand komut,
        CancellationToken cancellationToken = default)
    {
        var fikir = await ideaRepository.GetForProvinceAsync(komut.IdeaId, komut.ProvinceId, cancellationToken);
        if (fikir is null) return new SubmitImplementationReportResult.NotFound();

        // Durum geçişleri (plan §28).
        var now = clock.UtcNow;
        switch (komut.Status)
        {
            case ImplementationStatus.InProgress:
                fikir.StartImplementation(now);
                break;
            case ImplementationStatus.Completed:
                fikir.CompleteImplementation(now);
                break;
            case ImplementationStatus.Failed:
                fikir.FailImplementation(now);
                break;
            case ImplementationStatus.NotStarted:
                // notStarted = sadece kayıt; Idea durumu değişmez
                break;
        }

        var rapor = new ImplementationReport
        {
            Id = Guid.NewGuid(),
            IdeaId = komut.IdeaId,
            Status = komut.Status,
            Note = komut.Note,
            ReportedByUserId = komut.ReportedByUserId,
            ReportedAt = now,
        };
        await reportRepository.AddAsync(rapor, cancellationToken);
        await reportRepository.SaveChangesAsync(cancellationToken);
        return new SubmitImplementationReportResult.Ok(rapor.Id, now);
    }
}

public abstract record SubmitImplementationReportResult
{
    public sealed record Ok(Guid ReportId, DateTimeOffset ReportedAt) : SubmitImplementationReportResult;
    public sealed record NotFound : SubmitImplementationReportResult;
}
