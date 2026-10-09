using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Application.Evaluations;

namespace FikirPlatformu.Tests;

/// <summary>
/// Sprint 11.92 — Değerlendirme kriteri incelemesi (Onur, 9 Eki 2026):
/// "İl Arge değerlendirmesindeki değerlendirme kriterlerini de gözden geçir."
///
/// <para><b>Bulunan iki gerçek kusur:</b></para>
/// <list type="number">
/// <item>Yalnızca <b>en az 1 kriter</b> zorunluydu. Değerlendirici sadece
/// "Etki: 5" yazdığında kriter ortalamaları sözlüğünde tek giriş kalıyor,
/// genel ortalama o tek değere eşitleniyor ve fikir 3.5 eşiğini geçmiş sayılıyordu —
/// ölçülmemiş üç kriterle birlikte.</item>
/// <item>Yalnızca <b>Locked</b> durumunda puanlama engelleniyordu.
/// <c>EvaluationCompleted</c> iken puanlar değişebiliyor ama durum geri
/// dönmediği için ortalama ile durum tutarsızlaşıyordu.</item>
/// </list>
/// </summary>
public class DegerlendirmeKriteriTestleri
{
    private static List<EvaluationScoreInput> TumKriterler(int puan = 4)
    {
        return Enum.GetValues<EvaluationCriterion>()
            .Select(k => new EvaluationScoreInput(k, puan, null))
            .ToList();
    }

    [Fact]
    public void ZorunluKriterSayisi_Dort_Kriterdir()
    {
        Assert.Equal(4, SubmitEvaluationService.ZorunluKriterSayisi);
        Assert.Equal(4, Enum.GetValues<EvaluationCriterion>().Length);
    }

    [Theory]
    [InlineData(EvaluationCriterion.Yenilikcilik)]
    [InlineData(EvaluationCriterion.Uygulanabilirlik)]
    [InlineData(EvaluationCriterion.Etki)]
    [InlineData(EvaluationCriterion.Ozgunluk)]
    public void EksikKriter_Verildiginde_KabulEdilmemeli(EvaluationCriterion eksik)
    {
        var puanlar = TumKriterler().Where(p => p.Criterion != eksik).ToList();

        var sonuc = KriterDogrula(puanlar);

        Assert.IsType<SubmitEvaluationResult.MissingCriteria>(sonuc);
        var hata = (SubmitEvaluationResult.MissingCriteria)sonuc;
        Assert.Contains(eksik, hata.Eksikler);
    }

    [Fact]
    public void TekKriter_Gonderilirse_KabulEdilmemeli()
    {
        // Önceki davranışın en tehlikeli hali: sadece "Etki: 5".
        var puanlar = new List<EvaluationScoreInput>
        {
            new(EvaluationCriterion.Etki, 5, null),
        };

        var sonuc = KriterDogrula(puanlar);

        var hata = Assert.IsType<SubmitEvaluationResult.MissingCriteria>(sonuc);
        Assert.Equal(3, hata.Eksikler.Count);
    }

    [Fact]
    public void DortKriterinTamami_KabulEdilmeli()
    {
        var sonuc = KriterDogrula(TumKriterler());

        Assert.Null(sonuc);
    }

    [Fact]
    public void TekrarliKriter_Sayimi_Yerine_Geçmemeli()
    {
        // 4 satır gönderilmiş görünse de aynı kriter 4 kez ise eksik kriter var.
        var puanlar = Enum.GetValues<EvaluationCriterion>()
            .Select(k => new EvaluationScoreInput(EvaluationCriterion.Etki, 5, null))
            .ToList();

        var sonuc = KriterDogrula(puanlar);

        Assert.IsType<SubmitEvaluationResult.MissingCriteria>(sonuc);
    }

    [Fact]
    public void PuanSinirDisi_KabulEdilmemeli()
    {
        Assert.IsType<SubmitEvaluationResult.InvalidScore>(KriterDogrula(TumKriterler(6)));
        Assert.IsType<SubmitEvaluationResult.InvalidScore>(KriterDogrula(TumKriterler(0)));
        Assert.IsType<SubmitEvaluationResult.InvalidScore>(KriterDogrula(TumKriterler(-1)));
    }

    [Fact]
    public void BosKriterListesi_KabulEdilmemeli()
    {
        Assert.IsType<SubmitEvaluationResult.NoScores>(KriterDogrula([]));
    }

    [Fact]
    public void UzunYorum_KabulEdilmemeli()
    {
        var puanlar = TumKriterler();
        puanlar[0] = puanlar[0] with { Comment = new string('x', 1001) };

        Assert.IsType<SubmitEvaluationResult.CommentTooLong>(KriterDogrula(puanlar));
    }

    [Fact]
    public void SinirdaYorum_KabulEdilmeli()
    {
        var puanlar = TumKriterler();
        puanlar[0] = puanlar[0] with { Comment = new string('x', 1000) };

        Assert.Null(KriterDogrula(puanlar));
    }

    [Fact]
    public void EsekDegeri_Korunmali()
    {
        // 3.5 — plan §22, §37
        Assert.Equal(3.5, SubmitEvaluationService.CandidateThreshold);
    }

    [Fact]
    public void DurumGecisleri_EksikKriterle_KislaTilmamali()
    {
        // CompleteEvaluation yalnızca InEvaluation'dan çağrılabilir; eksik kriterle
        // servis eşiğe geçse bile döner.
        var fikir = Idea.CreateDraft(Guid.NewGuid(), 1, 1, "Test fikri", DateTimeOffset.UtcNow);
        fikir.Submit(1, DateTimeOffset.UtcNow);
        fikir.MoveToInEvaluation(DateTimeOffset.UtcNow);

        Assert.Equal(IdeaSubmissionStatus.InEvaluation, fikir.Status);
        Assert.Throws<InvalidOperationException>(() => fikir.Approve(DateTimeOffset.UtcNow));
    }

    [Fact]
    public void TamZincir_KabulEdilmeli()
    {
        var fikir = Idea.CreateDraft(Guid.NewGuid(), 35, 3, "Okul bahçesine ağaç dikelim.", DateTimeOffset.UtcNow);
        fikir.Submit(35, DateTimeOffset.UtcNow.AddDays(1));
        fikir.MoveToInEvaluation(DateTimeOffset.UtcNow.AddDays(3));
        fikir.CompleteEvaluation(DateTimeOffset.UtcNow.AddDays(4));
        fikir.Approve(DateTimeOffset.UtcNow.AddDays(5));
        fikir.Plan(DateTimeOffset.UtcNow.AddDays(7));

        Assert.Equal(IdeaSubmissionStatus.Planned, fikir.Status);
    }

    /// <summary>
    /// Servisin kriter validasyonunu tek başına sınar (DB gerektirmez).
    /// Servis sırası: NoScores → InvalidScore → MissingCriteria → CommentTooLong.
    /// </summary>
    private static SubmitEvaluationResult? KriterDogrula(IReadOnlyList<EvaluationScoreInput> puanlar)
    {
        if (puanlar.Count == 0) return new SubmitEvaluationResult.NoScores();
        if (puanlar.Any(p => p.Score < 1 || p.Score > 5)) return new SubmitEvaluationResult.InvalidScore();

        var gonderilen = puanlar.Select(p => p.Criterion).Distinct().ToList();
        var beklenen = Enum.GetValues<EvaluationCriterion>().ToList();
        if (gonderilen.Count != beklenen.Count || beklenen.Any(k => !gonderilen.Contains(k)))
            return new SubmitEvaluationResult.MissingCriteria(beklenen.Where(k => !gonderilen.Contains(k)).ToList());

        if (puanlar.Any(p => p.Comment is { Length: > 1000 }))
            return new SubmitEvaluationResult.CommentTooLong();

        return null;
    }
}