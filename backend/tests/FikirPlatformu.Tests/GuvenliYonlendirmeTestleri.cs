using FikirPlatformu.Api.Endpoints;

namespace FikirPlatformu.Tests;

/// <summary>
/// Sprint 11.84 — Güvenlik testi (YG-38) bulgusu: açık yönlendirme (open redirect).
///
/// <para>OAuth akışında <c>returnTo</c> sorgu parametresi doğrulanmadan
/// <c>state</c> içine yazılıyor ve callback sonunda <c>https://kotu-site.example</c>
/// gibi herhangi bir adrese yönlendirme yapılabiliyordu. Saldırgan kuruma ait bir
/// bağlantıyı paylaşıp kullanıcıyı kendi sitesine taşıyabiliyordu (OWASP A01:2021).</para>
///
/// <para>Düzeltme: <see cref="AuthEndpoints.GuvenliYonlendirmeHedefi"/> yalnızca
/// göreli yolları veya yapılandırılmış frontend origin'i ile aynı mutlak adresleri
/// kabul eder.</para>
/// </summary>
public class GuvenliYonlendirmeTestleri
{
    private const string Frontend = "https://fikir.yegitek.gov.tr";

    [Theory]
    // Saldırgan kontrolündeki adresler — hiçbiri kabul edilmemeli.
    [InlineData("https://kotu-saldirgan.example", "https://kotu-saldirgan.example/phishing")]
    [InlineData("http://kotu-saldirgan.example", "https://kotu-saldirgan.example/phishing")]
    [InlineData("https://fikir.yegitek.gov.tr.kotu.example", "https://fikir.yegitek.gov.tr.kotu.example")]
    [InlineData("https://kotu.example/fikir.yegitek.gov.tr", "https://kotu.example/fikir.yegitek.gov.tr")]
    [InlineData("//kotu-saldirgan.example", "https://kotu-saldirgan.example")]
    [InlineData("///kotu-saldirgan.example", "https://kotu-saldirgan.example")]
    public void Yabanci_adres_ana_sayfaya_duser(string returnTo, string _)
    {
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi(returnTo, Frontend);

        Assert.Equal(Frontend + "/", sonuc);
        Assert.DoesNotContain("kotu", sonuc, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("JavaScript:alert(document.cookie)")]
    [InlineData("data:text/html,<script>alert(1)</script>")]
    [InlineData("vbscript:msgbox(1)")]
    [InlineData("file:///etc/passwd")]
    [InlineData("ftp://kotu.example")]
    public void Tehlikeli_semalar_ana_sayfaya_duser(string returnTo)
    {
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi(returnTo, Frontend);

        Assert.Equal(Frontend + "/", sonuc);
        Assert.DoesNotContain(":", sonuc[Frontend.Length..], StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Bos_deger_ana_sayfaya_duser(string? returnTo)
    {
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi(returnTo, Frontend);

        Assert.Equal(Frontend + "/", sonuc);
    }

    [Theory]
    [InlineData("/", "/")]
    [InlineData("/giris", "/giris")]
    [InlineData("/mfa-login", "/mfa-login")]
    [InlineData("/admin/users?sayfa=2", "/admin/users?sayfa=2")]
    [InlineData("/sifre-sifirla#bolum-1", "/sifre-sifirla#bolum-1")]
    public void Goreli_yollar_frontend_altinda_kalir(string returnTo, string beklenen)
    {
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi(returnTo, Frontend);

        Assert.Equal(Frontend + beklenen, sonuc);
    }

    [Fact]
    public void Ayni_origin_mutlak_adres_kabul_edilir()
    {
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi(
            "https://fikir.yegitek.gov.tr/mfa-login?d=1", Frontend);

        Assert.Equal("https://fikir.yegitek.gov.tr/mfa-login?d=1", sonuc);
    }

    [Fact]
    public void Ayni_origin_farkli_port_reddedilir()
    {
        // https://fikir.yegitek.gov.tr:8443 farklı kaynaktır.
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi(
            "https://fikir.yegitek.gov.tr:8443/ele-gecir", Frontend);

        Assert.Equal(Frontend + "/", sonuc);
    }

    [Fact]
    public void Yonlendirmede_sorgu_dizesi_eklenebilir()
    {
        // Çağıran, güvenli hedefin sonuna kendi parametresini ekleyebilmeli.
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi("/mfa-login", Frontend);

        Assert.Equal($"{Frontend}/mfa-login?gmail_oauth=ok&has_token=1",
            $"{sonuc}?gmail_oauth=ok&has_token=1");
    }

    [Fact]
    public void Frontend_tanimli_degilse_ana_sayfa_guvenli()
    {
        var sonuc = AuthEndpoints.GuvenliYonlendirmeHedefi("https://kotu.example", string.Empty);

        Assert.Equal("/", sonuc);
    }
}
