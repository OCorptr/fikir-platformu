namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Open redirect koruması (plan §3.3 — Sprint 3).
/// Sadece uygulamanın kendi frontend adresine veya relative "/" ile başlayan local URL'lere izin verir.
/// </summary>
public static class YerelUrlYardimci
{
    /// <summary>
    /// Verilen URL güvenli mi kontrol eder:
    /// - Boş/null ise false
    /// - "//" veya "/\" ile başlıyorsa (protocol-relative) false
    /// - Absolute URL ise sadece beyaz listedeki host'lere izin ver
    /// - Relative URL ise "/" ile başlıyorsa true
    /// </summary>
    public static bool GuvenliMi(string? url, IEnumerable<string> izinliOriginler)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        // Protocol-relative URL (//evil.com) — açık saldırı vektörü.
        if (url.StartsWith("//") || url.StartsWith("/\\")) return false;

        // Relative path (/panel, /login, vs) — kabul.
        if (url.StartsWith("/")) return true;

        // Absolute URL ise origin kontrolü.
        if (Uri.TryCreate(url, UriKind.Absolute, out var parsed))
        {
            return izinliOriginler.Any(o =>
                parsed.Scheme == Uri.UriSchemeHttps || parsed.Scheme == Uri.UriSchemeHttp
                    ? string.Equals(parsed.GetLeftPart(UriPartial.Authority), o.TrimEnd('/'),
                        StringComparison.OrdinalIgnoreCase)
                    : false);
        }

        return false;
    }

    /// <summary>
    /// Güvenli URL'yi döner; güvenli değilse null döner (yönlendirme yapılmaz).
    /// Frontend'in kendi kök URL'sine düşmesi için "/".
    /// </summary>
    public static string? GuvenliVeyaNull(string? url, IEnumerable<string> izinliOriginler)
        => GuvenliMi(url, izinliOriginler) ? url : null;
}