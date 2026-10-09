using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Implementations;

namespace FikirPlatformu.Tests;

/// <summary>
/// Sprint 11.92 — "Hayata Geçir" akışı (Onur).
///
/// <para>Talep: "Bazen ayın fikri seçilmese bile o fikir hayata geçirilip arşedeki
/// bir projeyle paralel bir şeyler yapılabilir."</para>
///
/// <para><b>Önceki davranış:</b> <c>StartImplementation</c> yalnızca
/// <c>Planned</c> durumunu kabul ediyordu. <c>Planned</c> yalnızca BAKANLIĞIN
/// kategori adayı seçmesiyle oluşuyor. Yani il onaylı (Locked) ama aday
/// olmayan bir fikir hiçbir yoldan uygulamaya başlatılamıyordu.</para>
/// </summary>
public class HayataGecirmeTestleri
{
    private static Idea OnayliFikir()
    {
        // Draft → Submitted → InEvaluation → EvaluationCompleted → Locked
        var fikir = Idea.CreateDraft(Guid.NewGuid(), 35, 3, "Okul bahçesine ağaç dikelim.", DateTimeOffset.UtcNow);
        fikir.Submit(35, DateTimeOffset.UtcNow.AddDays(1));
        fikir.MoveToInEvaluation(DateTimeOffset.UtcNow.AddDays(2));
        fikir.CompleteEvaluation(DateTimeOffset.UtcNow.AddDays(3));
        fikir.Approve(DateTimeOffset.UtcNow.AddDays(4));
        return fikir;
    }

    [Fact]
    public void IlOnayli_AdayOlmayan_Fikir_HayataGecirilebilir()
    {
        var fikir = OnayliFikir();
        Assert.Equal(IdeaSubmissionStatus.Locked, fikir.Status);
        Assert.False(fikir.BakanlikAdayiMi);

        fikir.StartImplementation(DateTimeOffset.UtcNow.AddDays(5));

        Assert.Equal(IdeaSubmissionStatus.ImplementationInProgress, fikir.Status);
    }

    [Fact]
    public void BakanlikAdayi_Fikir_De_HayataGecirilebilir()
    {
        var fikir = OnayliFikir();
        fikir.Plan(DateTimeOffset.UtcNow.AddDays(5));
        Assert.True(fikir.BakanlikAdayiMi);

        fikir.StartImplementation(DateTimeOffset.UtcNow.AddDays(6));

        Assert.Equal(IdeaSubmissionStatus.ImplementationInProgress, fikir.Status);
    }

    [Fact]
    public void DegerlendirmeAsamasindaki_Fikir_HayataGecirilemez()
    {
        var fikir = Idea.CreateDraft(Guid.NewGuid(), 35, 3, "Test fikri", DateTimeOffset.UtcNow);
        fikir.Submit(35, DateTimeOffset.UtcNow);
        fikir.MoveToInEvaluation(DateTimeOffset.UtcNow);

        Assert.Throws<InvalidOperationException>(
            () => fikir.StartImplementation(DateTimeOffset.UtcNow));
    }

    [Fact]
    public void IlOnayliFikirden_ParalelYurutme_Sonrasi_TamamlamaVeBasarisiz()
    {
        // Aday olmadan uygulamaya başlayan fikir normal akışı tamamlayabilmeli.
        var fikir = OnayliFikir();
        fikir.StartImplementation(DateTimeOffset.UtcNow.AddDays(5));
        fikir.CompleteImplementation(DateTimeOffset.UtcNow.AddDays(10));
        Assert.Equal(IdeaSubmissionStatus.ImplementationCompleted, fikir.Status);

        // Başarısız işaretlemesi de yine aday olmayan fikir için çalışmalı.
        var fikir2 = OnayliFikir();
        fikir2.StartImplementation(DateTimeOffset.UtcNow.AddDays(5));
        fikir2.FailImplementation(DateTimeOffset.UtcNow.AddDays(6));
        Assert.Equal(IdeaSubmissionStatus.ImplementationFailed, fikir2.Status);
    }

    [Fact]
    public void IliskiliProje_MevcutDegilse_BosYazilabilir()
    {
        // RelatedProject opsiyoneldir; rapor kaydı bunu engellememeli.
        var rapor = new ImplementationReport
        {
            Id = Guid.NewGuid(),
            IdeaId = Guid.NewGuid(),
            Status = ImplementationStatus.InProgress,
            Note = "",
            RelatedProject = null,
            ReportedByUserId = "kullanici",
            ReportedAt = DateTimeOffset.UtcNow,
        };

        Assert.Null(rapor.RelatedProject);
    }
}