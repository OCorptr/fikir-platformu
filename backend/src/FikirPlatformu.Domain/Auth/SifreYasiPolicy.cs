namespace FikirPlatformu.Domain.Auth;

/// <summary>
/// YEĞİTEK güvenlik gereksinimi YG-17 — periyodik parola değişimi.
///
/// Kural (Onur kararı, Sprint 11.60):
///   - Zorunlu DEĞİL : Student, ProvinceEvaluator, ProvinceManager
///   - Zorunlu        : MinistryOfficial
///   - Muaf (istisna) : SystemAdmin
///
/// Gerekçe: Zorunluluk, başkalarının verisine erişebilen hesaplar içindir.
/// Öğrenci hesabı yalnızca kendi kaydını görür; 90 günde bir şifre değişimi
/// kamuya açık fikir platformunda kullanıcı deneyimini bozar ve destek
/// yükünü artırır. Sistem yöneticisi muaftır çünkü kilitlenme riski
/// (kimse sisteme giremez hale gelir) yetkili hesaplarda kabul edilemez.
/// </summary>
public static class SifreYasiPolicy
{
    /// <summary>Zorunlu değişim eşiği (gün).</summary>
    public const int ZorunluGun = 90;

    /// <summary>Uyarı gösterilecek eşik (gün).</summary>
    public const int UyariGun = 75;

    /// <summary>Zorunlu değişimden muaf tutulan roller.</summary>
    public static readonly string[] MuafRoller = ["SystemAdmin"];

    public sealed record Durum(
        int? YasiGun,
        int? KalanGun,
        bool UyariGerekli,
        bool DegistirmeZorunlu,
        string? Gerekce);

    public static bool MuafMi(IEnumerable<string> roller)
        => roller.Any(r => MuafRoller.Contains(r, StringComparer.OrdinalIgnoreCase));

    public static Durum Hesapla(DateTimeOffset? passwordChangedAt, IEnumerable<string> roller)
    {
        var rollerList = roller as IList<string> ?? roller.ToList();

        if (MuafMi(rollerList))
            return new Durum(null, null, false, false, "Rol muafiyeti");

        // Kayıt tarihi bilinmiyorsa en kötü senaryo uygulanır: değişim zorunlu.
        // (Başlangıçta eksik kayıtlar startup SQL'i ile doldurulur.)
        if (!passwordChangedAt.HasValue)
            return new Durum(null, null, true, true, "Değişiklik tarihi kayıtlı değil");

        var gun = (int)Math.Floor((DateTimeOffset.UtcNow - passwordChangedAt.Value).TotalDays);
        var kalan = ZorunluGun - gun;

        return new Durum(
            YasiGun: gun,
            KalanGun: kalan > 0 ? kalan : 0,
            UyariGerekli: gun >= UyariGun,
            DegistirmeZorunlu: gun >= ZorunluGun,
            Gerekce: gun >= ZorunluGun ? "Parola yaşı 90 günü aştı" : null);
    }
}
