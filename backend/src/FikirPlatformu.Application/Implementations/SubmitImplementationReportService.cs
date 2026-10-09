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
    string ReportedByUserId,
    /// <summary>Sprint 11.92: fikir hangi mevcut proje kapsamında uygulanıyor (opsiyonel).</summary>
    string? RelatedProject = null);

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

        // Sprint 11.92: "İlişkili proje" yazısı 500 karakteri aşamaz.
        var iliskiliProje = (komut.RelatedProject ?? "").Trim();
        if (iliskiliProje.Length > 500)
            return new SubmitImplementationReportResult.RelatedProjectTooLong();

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
            RelatedProject = string.IsNullOrEmpty(iliskiliProje) ? null : iliskiliProje,
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
    /// <summary>Sprint 11.92: ilişkili proje metni 500 karakteri aşıyor.</summary>
    public sealed record RelatedProjectTooLong : SubmitImplementationReportResult;
}
