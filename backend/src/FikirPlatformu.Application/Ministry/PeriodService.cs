using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Ministry;

namespace FikirPlatformu.Application.Ministry;

public sealed record CreatePeriodCommand(string Label, DateTimeOffset StartAt);

public sealed class PeriodService(
    IPeriodRepository periodRepository,
    IIdeaRepository ideaRepository,
    IClock clock)
{
    public const int PeriodMonths = 3;

    public async Task<Period> CreateAsync(CreatePeriodCommand komut, CancellationToken cancellationToken = default)
    {
        var period = new Period
        {
            Id = Guid.NewGuid(),
            Label = komut.Label,
            StartAt = komut.StartAt,
            EndAt = komut.StartAt.AddMonths(PeriodMonths),
            Status = PeriodStatus.Open,
            CreatedAt = clock.UtcNow,
        };
        await periodRepository.AddAsync(period, cancellationToken);
        await periodRepository.SaveChangesAsync(cancellationToken);
        return period;
    }

    public async Task<SelectForPeriodResult> SelectAsync(
        Guid periodId,
        int categoryId,
        Guid ideaId,
        string selectedByUserId,
        CancellationToken cancellationToken = default)
    {
        var period = await periodRepository.GetAsync(periodId, cancellationToken);
        if (period is null) return new SelectForPeriodResult.PeriodNotFound();
        if (period.Status != PeriodStatus.Open) return new SelectForPeriodResult.PeriodClosed();

        // Zaten seçim varsa hata (plan §26: her kategoriden 1).
        if (await periodRepository.CategoryHasSelectionAsync(periodId, categoryId, cancellationToken))
            return new SelectForPeriodResult.CategoryAlreadySelected();

        // Fikir kontrolü: Locked durumda + kategori eşleşmeli.
        var fikir = await ideaRepository.GetForAnyProvinceAsync(ideaId, cancellationToken);
        if (fikir is null) return new SelectForPeriodResult.IdeaNotFound();
        if (fikir.Status != IdeaSubmissionStatus.Locked) return new SelectForPeriodResult.IdeaNotLocked();
        if (fikir.CategoryId != categoryId) return new SelectForPeriodResult.CategoryMismatch();

        await periodRepository.AddSelectionAsync(new PeriodSelection
        {
            PeriodId = periodId,
            CategoryId = categoryId,
            IdeaId = ideaId,
            SelectedByUserId = selectedByUserId,
            SelectedAt = clock.UtcNow,
        }, cancellationToken);
        await periodRepository.SaveChangesAsync(cancellationToken);

        fikir.Plan(clock.UtcNow);
        await ideaRepository.SaveChangesAsync(cancellationToken);

        return new SelectForPeriodResult.Ok(clock.UtcNow);
    }
}

public abstract record SelectForPeriodResult
{
    public sealed record Ok(DateTimeOffset SelectedAt) : SelectForPeriodResult;
    public sealed record PeriodNotFound : SelectForPeriodResult;
    public sealed record PeriodClosed : SelectForPeriodResult;
    public sealed record CategoryAlreadySelected : SelectForPeriodResult;
    public sealed record IdeaNotFound : SelectForPeriodResult;
    public sealed record IdeaNotLocked : SelectForPeriodResult;
    public sealed record CategoryMismatch : SelectForPeriodResult;
}
