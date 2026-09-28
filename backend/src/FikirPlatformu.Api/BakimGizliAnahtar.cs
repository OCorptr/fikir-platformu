using System.Security.Cryptography;
using System.Text;

namespace FikirPlatformu.Api;

/// <summary>
/// Bakım (/api/__maintenance/*) ve debug (/api/__debug/*, /api/auth/__debug/*)
/// endpoint'lerinin ortak gizli anahtar denetimi.
///
/// Sprint 11.52 güvenlik sertleştirmesi:
///   - Kod içine gömülü varsayılan anahtar KALDIRILDI (Sprint 11.52).
///   - <c>AdminMaintenance__Secret</c> ortam değişkeni tanımlı değilse bu endpoint'ler
///     403 döner, yani kapalı sayılır (fail-closed).
///   - Karşılaştırma sabit zamanlıdır (timing attack koruması).
/// </summary>
internal static class BakimGizliAnahtar
{
    /// <summary>Ortam değişkeni adı (docs/runbook.md ile aynı).</summary>
    public const string AyarAnahtari = "AdminMaintenance:Secret";

    /// <summary>Anahtar tanımlı mı? Tanımlı değilse endpoint'ler devre dışıdır.</summary>
    public static bool Tanimli(IConfiguration yapilandirma)
    {
        var deger = yapilandirma[AyarAnahtari];
        return !string.IsNullOrWhiteSpace(deger);
    }

    /// <summary>İstekte gelen <c>?token=</c> ile beklenen anahtar eşleşiyor mu?</summary>
    public static bool Gecerli(HttpContext http, IConfiguration yapilandirma)
    {
        var beklenen = yapilandirma[AyarAnahtari];
        if (string.IsNullOrWhiteSpace(beklenen))
        {
            return false;
        }

        var verilen = http.Request.Query["token"].ToString();
        if (string.IsNullOrEmpty(verilen))
        {
            return false;
        }

        return FixedTimeEquals(verilen, beklenen);
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var x = Encoding.UTF8.GetBytes(a);
        var y = Encoding.UTF8.GetBytes(b);
        // Farklı uzunlukta ikisi de eşit olamaz; ama "kısa girdi kısa zamanda elenir"
        // bilgi sızıntısını önlemek için önce uzunluk karşılaştırması da sabit zamanlı.
        var fark = x.Length ^ y.Length;
        var n = Math.Max(x.Length, y.Length);
        for (var i = 0; i < n; i++)
        {
            fark |= (i < x.Length ? x[i] : 0) ^ (i < y.Length ? y[i] : 0);
        }

        return fark == 0;
    }
}
