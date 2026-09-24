using Microsoft.AspNetCore.DataProtection;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Data Protection API ile hassas alanları şifrele/çöz (plan §6.4 + YEĞİTEK gereksinim #8).
/// TOTP secret gibi alanlar DB'de düz metin yerine korumalı (encrypted) formatta saklanır.
/// Purpose string "FikirPlatformu.TotpSecret" — aynı app için tutarlı, başka amaçla karıştırılmaz.
/// </summary>
public sealed class HassasVeriSifreleme
{
    private const string Purpose = "FikirPlatformu.TotpSecret";
    private readonly IDataProtector _protector;

    public HassasVeriSifreleme(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector(Purpose);
    }

    /// <summary>Düz metni şifreler (çıktı: base64url encoded cipher text).</summary>
    public string Sifrele(string duzMetin)
    {
        if (string.IsNullOrEmpty(duzMetin)) return "";
        return _protector.Protect(duzMetin);
    }

    /// <summary>Şifreli metni çözer. Şifreleme yoksa veya bozuksa boş string döner (audit'te tutulabilir).</summary>
    public string Coz(string sifreliMetin)
    {
        if (string.IsNullOrEmpty(sifreliMetin)) return "";
        try
        {
            return _protector.Unprotect(sifreliMetin);
        }
        catch
        {
            // Eski/bozuk şifreli veri — kullanıcı MFA'yı yeniden kurmalı.
            return "";
        }
    }
}