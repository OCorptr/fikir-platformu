using FikirPlatformu.Api.Endpoints;

namespace FikirPlatformu.Tests;

/// <summary>
/// Sprint 11.92 — Ana sayfa "Ayın Fikri" öğrenci adı maskeleme testleri.
///
/// <para>Ana sayfa kimlik doğrulaması gerektirmeyen herkese açık bir sayfa.
/// Gerçek dönem seçimlerine bağlandığında öğrencinin adı ve soyadı kamuya
/// açık hale gelecekti. Onur kararı (9 Eki 2026): soyad YALNIZCA başharf
/// olarak gösterilir — "Emir K." Soyadın tamamı hiçbir koşulda sızmamalı.</para>
///
/// <para>KVKK bağlamı: projede öğrencilere karşı gizlilik çizgisi var
/// (admin paneli öğrenci rollerini hiç listelemez). Bu test, maskenin
/// kazara gevşetilmesini yakalar.</para>
/// </summary>
public class OgrenciAdiMaskelemeTestleri
{
    [Theory]
    [InlineData("Emir", "Koç", "Emir K.")]
    [InlineData("Zeynep", "Kaya", "Zeynep K.")]
    [InlineData("Mert", "Demir", "Mert D.")]
    public void Ad_ve_Soyad_BasHarfi_ile_Maskelenir(string ad, string soyad, string beklenen)
    {
        Assert.Equal(beklenen, KisiselVeriYardimci.OgrenciAdiMaskele(ad, soyad));
    }

    [Fact]
    public void Soyad_Asla_Tam_Gorunmez()
    {
        var sonuc = KisiselVeriYardimci.OgrenciAdiMaskele("Emir", "Koç");

        Assert.DoesNotContain("Koç", sonuc);
        Assert.DoesNotContain("Koc", sonuc.ToLowerInvariant());
        Assert.Equal(1, sonuc.Count(c => c == '.'));
    }

    [Fact]
    public void Bos_Soyad_Durumunda_Yalnizca_Ad_Gorunur()
    {
        Assert.Equal("Elif", KisiselVeriYardimci.OgrenciAdiMaskele("Elif", ""));
        Assert.Equal("Elif", KisiselVeriYardimci.OgrenciAdiMaskele("Elif", null));
    }

    [Theory]
    [InlineData("", "Şahin", "Ş.")]
    [InlineData("", "Yılmaz", "Y.")]
    [InlineData("   ", "Koç", "K.")]
    public void Bos_Ad_Durumunda_Soyadin_BasHarfi_Gorunur(string ad, string soyad, string beklenen)
    {
        Assert.Equal(beklenen, KisiselVeriYardimci.OgrenciAdiMaskele(ad, soyad));
    }

    [Fact]
    public void Tamamen_Bos_Veri_Anonim_Kalir()
    {
        Assert.Equal("Öğrenci", KisiselVeriYardimci.OgrenciAdiMaskele(null, null));
        Assert.Equal("Öğrenci", KisiselVeriYardimci.OgrenciAdiMaskele("", ""));
    }

    [Fact]
    public void Bastaki_ve_Sondaki_Bosluklar_Temizlenir()
    {
        Assert.Equal("Arda Y.", KisiselVeriYardimci.OgrenciAdiMaskele("  Arda  ", "  Yılmaz "));
    }
}