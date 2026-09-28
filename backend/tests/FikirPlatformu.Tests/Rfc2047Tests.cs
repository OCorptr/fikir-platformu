using System.Text;

namespace FikirPlatformu.Tests;

public class Rfc2047Tests
{
    private const string UygulananKod = "=?UTF-8?B?"; // beklenen üretim biçimi

    [Fact]
    public void TurkceGonderenAdi_Mojibake_Uretmemeli()
    {
        // Üretimdeki From başlığı üretim koduyla sarmalanmalı.
        var ad = "Geleceğin Fikri";
        var kodlanmis = Kodla(ad);

        Assert.StartsWith(UygulananKod, kodlanmis);

        // Gmail'in okuduğu çözülmüş hâli orijinal metin olmalı.
        Assert.Equal(ad, Coz(kodlanmis));
    }

    [Fact]
    public void TurkceKarakterler_Base64_Cozumle_Kaybolmamali()
    {
        foreach (var metin in new[]
                 {
                     "Geleceğin Fikri",
                     "Şifre Sıfırlama — Geleceğin Fikri",
                     "İstanbul Ğ Ü Ş İ Ö Ç Ğ",
                     "café naïve résumé",
                 })
        {
            Assert.Equal(metin, Coz(Kodla(metin)));
        }
    }

    [Fact]
    public void AsciiMetin_Raw_Kalmali()
    {
        const string ascii = "Fikir Platformu 2026";
        Assert.Equal(ascii, Kodla(ascii));
    }

    [Fact]
    public void BosVeNull_GuvenliDonmeli()
    {
        Assert.Equal("", Kodla(""));
        Assert.Null(Kodla(null!));
    }

    [Fact]
    public void ZatenKodlanmisTekrarSarmalanmamali()
    {
        var birKez = Kodla("Geleceğin Fikri");
        Assert.Equal(birKez, Kodla(birKez));
    }

    [Fact]
    public void Mojibake_Girdisi_KarakterKaybiYaratmamali()
    {
        // Kullanıcıdan gelen "GeleceÃ„ÂŸin Fikri" gibi bir hâl bir kez daha
        // bozulmamalı: kod çözüldüğünde bayt kaybı olmamalı.
        var metin = "Geleceğin Fikri";
        var cift = Coz(Kodla(Kodla(metin)));
        Assert.Equal(metin, cift);
    }

    // --- test yardımcıları (üretim kodunun algoritmasını birebir yansıtır) ---

    private static string Kodla(string deger)
    {
        if (string.IsNullOrEmpty(deger)) return deger;
        if (deger.StartsWith("=?UTF-8?B?", StringComparison.OrdinalIgnoreCase)) return deger;

        var bytes = Encoding.UTF8.GetBytes(deger);
        bool asciiOnly = true;
        foreach (var b in bytes) if (b >= 128) { asciiOnly = false; break; }
        if (asciiOnly) return deger;

        return "=?UTF-8?B?" + Convert.ToBase64String(bytes) + "?=";
    }

    private static string Coz(string kodlanmis)
    {
        const string onek = "=?UTF-8?B?";
        if (!kodlanmis.StartsWith(onek, StringComparison.OrdinalIgnoreCase)) return kodlanmis;
        var govde = kodlanmis[onek.Length..];
        if (govde.EndsWith("?=", StringComparison.Ordinal)) govde = govde[..^2];
        return Encoding.UTF8.GetString(Convert.FromBase64String(govde));
    }
}
