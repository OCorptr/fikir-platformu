namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Kişisel veri maskeleme yardımcıları (YEĞİTEK gereksinim #9 — loglarda PII olmaz).
/// - Email: ilk karakter + "***@" + domain (örn. "a***@fikir.meb.gov.tr")
/// - IP adresi: son okteti mask'le (örn. "192.168.1.***")
/// Diğer PII alanları (ad, soyad, TC, telefon) açık metin loglanmaz.
/// </summary>
public static class KisiselVeriYardimci
{
    /// <summary>
    /// Email'i loglamak için güvenli hale getirir.
    /// Boş/geçersiz email'ler olduğu gibi (boş string) döner.
    /// </summary>
    public static string EmailMaskele(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return "";
        var at = email.IndexOf('@');
        if (at <= 0 || at == email.Length - 1) return "***";
        var ilk = email[0];
        var domain = email[(at + 1)..];
        // Format: a***@domain (ilk harf görünür, orta kısım mask'li, @ ve domain korunur)
        return $"{ilk}***@{domain}";
    }

    /// <summary>
    /// IPv4 adresinin son oktetini mask'ler. IPv6 veya null için olduğu gibi (kısmi mask) döner.
    /// </summary>
    public static string IpMaskele(string? ip)
    {
        if (string.IsNullOrWhiteSpace(ip)) return "";
        var sonNokta = ip.LastIndexOf('.');
        if (sonNokta > 0 && ip[..sonNokta].All(c => char.IsDigit(c) || c == '.'))
            return ip[..sonNokta] + ".***";
        // IPv6 veya bilinmeyen format — son 4 karakter mask'le.
        if (ip.Length > 4) return ip[..^4] + "****";
        return "***";
    }
}