using FikirPlatformu.Application.Abstractions;
using FikirPlatformu.Application.Ideas;
using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;

namespace FikirPlatformu.Application.Evaluations;

public sealed record EvaluationScoreInput(EvaluationCriterion Criterion, int Score, string? Comment);

public sealed record SubmitEvaluationCommand(
    Guid IdeaId,
    int ProvinceId,
    string EvaluatorUserId,
    IReadOnlyList<EvaluationScoreInput> Scores);

public sealed class SubmitEvaluationService(
    IIdeaRepository ideaRepository,
    IIdeaEvaluationRepository evaluationRepository,
    IClock clock)
{
    /// <summary>Adaylık eşiği (plan §22, §37 açık). 0–5 arası ortalama.</summary>
    public const double CandidateThreshold = 3.5;

    /// <summary>
    /// Sprint 11.92 — Değerlendirmede zorunlu kriter sayısı (Onur incelemesi).
    /// Dört kriterin (Yenilikçilik, Uygulanabilirlik, Etki, Özgünlük) TAMAMI
    /// doldurulmadan değerlendirme kabul edilmez.
    ///
    /// <para><b>Neden:</b> Önceden "en az 1 kriter" yeterliydi. Bir değerlendirici
    /// yalnızca "Etki: 5" yazdığında ortalamalar sözlüğünde tek kriter kalıyor,
    /// genel ortalama o tek değere eşitleniyor ve fikir eşiği (3.5) aşmış sayılıyordu
    /// — henüz değerlendirilmemiş üç kriterle birlikte. Yani fikir, ölçülmemiş alanlar
    /// yüzünden aday havuzuna girebiliyordu.</para>
    /// </summary>
    public static int ZorunluKriterSayisi => Enum.GetValues<EvaluationCriterion>().Length;

    public async Task<SubmitEvaluationResult> SubmitAsync(SubmitEvaluationCommand komut, CancellationToken cancellationToken = default)
    {
        var fikir = await ideaRepository.GetForProvinceAsync(komut.IdeaId, komut.ProvinceId, cancellationToken);
        if (fikir is null) return new SubmitEvaluationResult.NotFound();
        if (fikir.Status == IdeaSubmissionStatus.Locked) return new SubmitEvaluationResult.Locked();

        // Sprint 11.92: Değerlendirme bittiğinde yeni puan kabul edilmez.
        // Önceden yalnızca Locked engelleniyordu; EvaluationCompleted durumunda
        // puanlar değişebiliyor ama durum geri dönmediği için ortalama ile
        // durum tutarsızlaşıyordu (puan düşer, fikir yine de "değerlendirildi" kalıyor).
        if (fikir.Status == IdeaSubmissionStatus.EvaluationCompleted)
            return new SubmitEvaluationResult.AlreadyCompleted();

        // Validasyon: 1..5 arası puan
        if (komut.Scores.Count == 0) return new SubmitEvaluationResult.NoScores();
        if (komut.Scores.Any(s => s.Score < 1 || s.Score > 5))
            return new SubmitEvaluationResult.InvalidScore();

        // Sprint 11.92: Dört kriterin tamamı zorunlu, tekrarlı kriter yasak.
        var gonderilen = komut.Scores.Select(s => s.Criterion).Distinct().ToList();
        var beklenen = Enum.GetValues<EvaluationCriterion>().ToList();
        if (gonderilen.Count != beklenen.Count || beklenen.Any(k => !gonderilen.Contains(k)))
            return new SubmitEvaluationResult.MissingCriteria(beklenen);

        // Yorum uzunluk sınırı — değerlendirici öğrenciye serbest metin yazıyor.
        if (komut.Scores.Any(s => s.Comment is { Length: > 1000 }))
            return new SubmitEvaluationResult.CommentTooLong();

        // Upsert: aynı evaluator aynı kriter için birden fazla puan veremez; son yazan kazanır.
        foreach (var s in komut.Scores)
        {
            await evaluationRepository.UpsertAsync(new Evaluation
            {
                IdeaId = komut.IdeaId,
                EvaluatorUserId = komut.EvaluatorUserId,
                Criterion = s.Criterion,
                Score = s.Score,
                Comment = s.Comment,
                EvaluatedAt = clock.UtcNow,
            }, cancellationToken);
        }
        await evaluationRepository.SaveChangesAsync(cancellationToken);

        // Durum geçişi: ilk puanlama → InEvaluation; eşiği geçtiyse → EvaluationCompleted.
        if (fikir.Status == IdeaSubmissionStatus.Submitted)
        {
            fikir.MoveToInEvaluation(clock.UtcNow);
            await ideaRepository.SaveChangesAsync(cancellationToken);
        }

        var ortalamalar = await evaluationRepository.GetAveragesAsync(komut.IdeaId, cancellationToken);
        if (ortalamalar.Count > 0)
        {
            var genelOrtalama = ortalamalar.Values.Average();
            if (genelOrtalama >= CandidateThreshold && fikir.Status == IdeaSubmissionStatus.InEvaluation)
            {
                fikir.CompleteEvaluation(clock.UtcNow);
                await ideaRepository.SaveChangesAsync(cancellationToken);
            }
        }

        return new SubmitEvaluationResult.Ok(clock.UtcNow);
    }
}

public abstract record SubmitEvaluationResult
{
    public sealed record Ok(DateTimeOffset EvaluatedAt) : SubmitEvaluationResult;
    public sealed record NotFound : SubmitEvaluationResult;
    public sealed record Locked : SubmitEvaluationResult;
    public sealed record NoScores : SubmitEvaluationResult;
    public sealed record InvalidScore : SubmitEvaluationResult;
    /// <summary>Sprint 11.92: değerlendirme zaten tamamlandı, yeni puan alınamaz.</summary>
    public sealed record AlreadyCompleted : SubmitEvaluationResult;
    /// <summary>Sprint 11.92: dört kriterin tamamı gönderilmemiş.</summary>
    public sealed record MissingCriteria(IReadOnlyList<EvaluationCriterion> Eksikler) : SubmitEvaluationResult;
    /// <summary>Sprint 11.92: yorum 1000 karakteri aşıyor.</summary>
    public sealed record CommentTooLong : SubmitEvaluationResult;
}
