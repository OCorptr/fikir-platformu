using Microsoft.AspNetCore.DataProtection;

namespace FikirPlatformu.Infrastructure.Security;

/// <summary>
/// Data Protection API ile hassas alanları şifrele/çöz (plan §6.4 + YEĞİTEK gereksinim #8).
/// TOTP secret gibi alanlar DB'de düz metin yerine korumalı (encrypted) formatta saklanır.
/// Her alan için ayrı purpose: farklı key derivation, aynı amaçla paylaşılmaz.
/// </summary>
public sealed class HassasVeriSifreleme
{
    private const string TotpPurpose = "FikirPlatformu.TotpSecret";
    private const string GmailRefreshPurpose = "FikirPlatformu.GmailRefreshToken";
    private readonly IDataProtector _totpProtector;
    private readonly IDataProtector _gmailProtector;

    public HassasVeriSifreleme(IDataProtectionProvider provider)
    {
        _totpProtector = provider.CreateProtector(TotpPurpose);
        _gmailProtector = provider.CreateProtector(GmailRefreshPurpose);
    }

    /// <summary>Düz metni şifreler (çıktı: base64url encoded cipher text) — TOTP için.</summary>
    public string Sifrele(string duzMetin)
    {
        if (string.IsNullOrEmpty(duzMetin)) return "";
        return _totpProtector.Protect(duzMetin);
    }

    /// <summary>Şifreli metni çözer (TOTP). Şifreleme yoksa/bozuksa boş string döner.</summary>
    public string Coz(string sifreliMetin)
    {
        if (string.IsNullOrEmpty(sifreliMetin)) return "";
        try
        {
            return _totpProtector.Unprotect(sifreliMetin);
        }
        catch
        {
            // Eski/bozuk şifreli veri — kullanıcı MFA'yı yeniden kurmalı.
            return "";
        }
    }

    /// <summary>Gmail OAuth refresh token'ı encrypted sakla.</summary>
    public string SifreleGmail(string duzMetin)
    {
        if (string.IsNullOrEmpty(duzMetin)) return "";
        return _gmailProtector.Protect(duzMetin);
    }

    /// <summary>Gmail refresh token çöz. Bozuksa boş string döner.</summary>
    public string CozGmail(string sifreliMetin)
    {
        if (string.IsNullOrEmpty(sifreliMetin)) return "";
        try
        {
            return _gmailProtector.Unprotect(sifreliMetin);
        }
        catch
        {
            // Eski/bozuk şifreli veri — yeniden OAuth handshake gerekir.
            return "";
        }
    }
}
