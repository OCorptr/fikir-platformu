using System.Text;

namespace FikirPlatformu.Api;

/// <summary>
/// CORS beyaz listesi çözümleyici.
///
/// Sprint 11.52 güvenlik sertleştirmesi:
///   - Üretimde kod içine gömülü Render origin'i KALDIRILDI. Daha önce liste hiç
///     boş dönmediği için "aynı domain + nginx" moduna (SameSite=Lax, CORS'siz)
///     hiçbir zaman geçilemiyordu ve her kurulumda `Program.cs` elle düzeltilmek
///     zorunda kalıyordu.
///   - Artık liste boşsa SAME-ORIGIN moduna düşer: CORS middleware kurulmaz,
///     cookie'ler <c>SameSite=Lax</c> olur. En güvenli varsayılan budur.
///   - Render gibi ayrı-origin dağıtımlar opt-in'dir: <c>Cors__AllowedOrigins</c>
///     veya <c>Cors__AllowRenderFallback=true</c> ayarlanmalıdır.
/// </summary>
internal static class BakimCORS
{
    /// <summary>Render demo origin'i (yalnızca açıkça istenirse kullanılır).</summary>
    public const string RenderFrontendOrigin = "https://fikir-platformu-web.onrender.com";

    /// <summary>
    /// Aktif CORS origin listesini çözer. Boş dönerse same-origin modundadır.
    /// </summary>
    public static string[] AktifOriginler(IConfiguration yapilandirma, IHostEnvironment ortam)
    {
        var originler = yapilandirma
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>();

        // Sprint 11.28c: `Cors__AllowedOrigins__0` array binding bazen boş dönüyor
        // (env format değişikliği). Virgülle ayrılmış tek değer de desteklenir.
        if (originler == null || originler.Length == 0)
        {
            var tekDeger = yapilandirma["Cors:AllowedOrigins:0"]
                ?? yapilandirma["Cors__AllowedOrigins__0"]
                ?? yapilandirma["Cors__AllowedOrigins"];

            if (YerelDegerMi(tekDeger))
            {
                originler = tekDeger!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }
        }

        if (originler != null && originler.Length > 0)
        {
            return originler;
        }

        if (ortam.IsDevelopment())
        {
            return ["http://localhost:5173", "http://localhost:5174"];
        }

        // Üretimde Render fallback yalnızca açıkça istenirse.
        var fallbackAcik = yapilandirma.GetValue("Cors:AllowRenderFallback", false);
        if (fallbackAcik)
        {
            return [RenderFrontendOrigin];
        }

        // Boş = same-origin (nginx reverse proxy / aynı domain). En güvenli varsayılan.
        return [];
    }

    private static bool YerelDegerMi(string? deger)
        => !string.IsNullOrWhiteSpace(deger) && deger != "value";
}
