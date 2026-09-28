using System.Globalization;
using System.Text;
using System.Text.Json;
using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.ArkaPlan;

/// <summary>
/// YEĞİTEK güvenlik gereksinimi YG-13 / YG-18 — "hareket kayıtları izlenir,
/// kayıt altına alınır ve merkezî sisteme iletilir."
///
/// Seçilen çözüm (Onur kararı, Sprint 11.61): C — dosya + erişim.
///
///   Her gün 02:00 UTC'de bir denetim raporu üretilir:
///     - Biçim  : JSON Lines (satır satır JSON) + insan-okur özet (CSV)
///     - Konum  : `DenetimRapor__Klasor` (varsayılan ./denetim-raporlari)
///     - Saklama: `DenetimRapor__SaklamaGun` (varsayılan 400 gün)
///
///   Raporlar sistem yöneticisinin kendi ekranından istediği an
///   görüntülenebilir / indirilebilir:
///     GET /api/admin/raporlar
///     GET /api/admin/raporlar/{tarih}
///     GET /api/admin/raporlar/{tarih}/indir
///
/// Neden dosya: kurumun merkezî günlük toplama altyapısı (SIEM, log sunucusu)
/// teslim sırasında bilinmiyor. Dosya üretimi her ortamda çalışır, elle
/// veya betikle merkezî sisteme aktarılabilir, ve yönetici ekranından da
/// erişilebilir. Aktarımın otomatikleştirilmesi istenirse `Rapor__Url`
/// ortam değişkeni ile webhook eklenebilir; bu dokümante edilmiştir.
///
/// İçerik: kimlik doğrulama olayları + hesap/rol değişiklikleri.
/// Öğrenci kayıt gövdesi (fikir metni, ad-soyad) rapora YAZILMAZ — sadece
/// kim, ne zaman, ne yaptı. PII minimizasyonu (YG-09).
/// </summary>
public sealed class DenetimRaporServisi(
    IServiceProvider servisSaglayici,
    IConfiguration yapilandirma,
    ILogger<DenetimRaporServisi> gunluk) : BackgroundService
{
    private const string DizinAdi = "denetim-raporlari";
    private const string Onek = "denetim-";

    /// <summary>Rapora dahil edilen denetim olayları.</summary>
    private static readonly AuthEventType[] RaporlananOlaylar =
    [
        AuthEventType.LoginSuccess,
        AuthEventType.LoginFailure,
        AuthEventType.LoginLockedOut,
        AuthEventType.Logout,
        AuthEventType.PasswordChanged,
        AuthEventType.PasswordResetRequested,
        AuthEventType.PasswordResetCompleted,
        AuthEventType.MfaEnabled,
        AuthEventType.MfaDisabled,
        AuthEventType.MfaLoginSuccess,
        AuthEventType.MfaLoginFailure,
        AuthEventType.UserCreated,
        AuthEventType.UserUpdated,
        AuthEventType.UserDeleted,
        AuthEventType.RoleChanged,
        AuthEventType.AccountDisabled,
        AuthEventType.AccountReactivated,
        AuthEventType.KvkkRetentionApplied,
    ];

    public static string RaporKlasoru(IConfiguration cfg)
    {
        var ayar = cfg["DenetimRapor:Klasor"];
        if (string.IsNullOrWhiteSpace(ayar)) ayar = DizinAdi;
        return Path.IsPathRooted(ayar) ? ayar : Path.Combine(AppContext.BaseDirectory, ayar);
    }

    public static int SaklamaGunu(IConfiguration cfg) => Math.Max(30, cfg.GetValue("DenetimRapor:SaklamaGun", 400));

    public static bool EtkinMi(IConfiguration cfg) => cfg.GetValue("DenetimRapor:Etkin", true);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!EtkinMi(yapilandirma))
        {
            gunluk.LogInformation("DenetimRaporServisi devre dışı (DenetimRapor__Etkin=false).");
            return;
        }

        try
        {
            Directory.CreateDirectory(RaporKlasoru(yapilandirma));
        }
        catch (Exception ex)
        {
            gunluk.LogError(ex, "[DENETIM] Rapor klasörü oluşturulamadı: {Klasor}", RaporKlasoru(yapilandirma));
            return;
        }

        gunluk.LogInformation(
            "DenetimRaporServisi başladı. Klasör={Klasor}, saklama={Gun} gün, günlük 02:00 UTC.",
            RaporKlasoru(yapilandirma), SaklamaGunu(yapilandirma));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Bir sonraki 02:00 UTC'ye kadar bekle (ilk çalıştırmada hemen üretme).
                var bekleme = SonrakiCalismaZamani() - DateTimeOffset.UtcNow;
                if (bekleme > TimeSpan.Zero)
                    await Task.Delay(bekleme, stoppingToken);

                _ = await GunlukRaporUretAsync(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), stoppingToken);
                _ = EskiRaporlariTemizle(stoppingToken);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                gunluk.LogError(ex, "[DENETIM] Günlük rapor üretilemedi.");
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }
    }

    internal static DateTimeOffset SonrakiCalismaZamani()
    {
        var simdi = DateTimeOffset.UtcNow;
        var hedef = new DateTimeOffset(simdi.Year, simdi.Month, simdi.Day, 2, 0, 0, TimeSpan.Zero);
        return hedef > simdi ? hedef : hedef.AddDays(1);
    }

    public static string DosyaAdi(DateOnly tarih) => $"{Onek}{tarih:yyyy-MM-dd}.jsonl";

    /// <summary>
    /// Belirli bir günün denetim raporunu üretir. Dönen satır sayısı kayıt adedidir.
    /// </summary>
    public async Task<int> GunlukRaporUretAsync(DateOnly tarih, CancellationToken cancellationToken)
    {
        using var kapsam = servisSaglayici.CreateScope();
        var db = kapsam.ServiceProvider.GetRequiredService<FikirPlatformuDbContext>();

        var baslangic = tarih.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var bitis = baslangic.AddDays(1);

        var kayitlar = await db.AuthEvents.AsNoTracking()
            .Where(e => e.EventType != null && RaporlananOlaylar.Contains(e.EventType)
                && e.CreatedAt >= baslangic && e.CreatedAt < bitis)
            .OrderBy(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        var klasor = RaporKlasoru(yapilandirma);
        Directory.CreateDirectory(klasor);

        var yol = Path.Combine(klasor, DosyaAdi(tarih));
        await File.WriteAllTextAsync(yol, JsonlIcerigi(kayitlar), Encoding.UTF8, cancellationToken);

        var ozet = Path.Combine(klasor, $"{Onek}{tarih:yyyy-MM-dd}-ozet.csv");
        await File.WriteAllTextAsync(ozet, CsvOzeti(kayitlar), new UTF8Encoding(true), cancellationToken);

        gunluk.LogInformation(
            "[DENETIM] {Tarih} raporu üretildi: {Sayi} kayıt → {Dosya}",
            tarih, kayitlar.Count, yol);

        return kayitlar.Count;
    }

    /// <summary>Saklama süresini aşan raporları siler. Silinen dosya sayısını döner.</summary>
    public int EskiRaporlariTemizle(CancellationToken cancellationToken)
    {
        var klasor = RaporKlasoru(yapilandirma);
        if (!Directory.Exists(klasor)) return 0;

        var esik = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-SaklamaGunu(yapilandirma));
        int silinen = 0;

        foreach (var dosya in Directory.EnumerateFiles(klasor, $"{Onek}*.jsonl"))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var tarih = DosyaTarihiniCoz(dosya);
            if (tarih is null || tarih.Value >= esik) continue;

            try { File.Delete(dosya); silinen++; }
            catch (IOException ex) { gunluk.LogWarning(ex, "[DENETIM] Eski rapor silinemedi: {Dosya}", dosya); }

            var ozet = Path.Combine(klasor, $"{Onek}{tarih:yyyy-MM-dd}-ozet.csv");
            if (File.Exists(ozet))
            {
                try { File.Delete(ozet); } catch (IOException) { /* yoksay */ }
            }
        }

        if (silinen > 0)
            gunluk.LogInformation("[DENETIM] {Sayi} rapor saklama süresi ({Gun} gün) aşıldığı için silindi.", silinen, SaklamaGunu(yapilandirma));
        return silinen;
    }

    private static DateOnly? DosyaTarihiniCoz(string yol)
    {
        var ad = Path.GetFileNameWithoutExtension(yol);
        if (!ad.StartsWith(Onek, StringComparison.Ordinal)) return null;
        var tarihMetni = ad[Onek.Length..];
        return DateOnly.TryParseExact(tarihMetni, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d
            : null;
    }

    /// <summary>JSON Lines gövdesi. Satır başına bir olay — merkezî toplayıcı için.</summary>
    internal static string JsonlIcerigi(IReadOnlyList<AuthEvent> kayitlar)
    {
        var sb = new StringBuilder();
        foreach (var k in kayitlar)
        {
            sb.Append(JsonSerializer.Serialize(new
            {
                zaman = k.CreatedAt.ToString("o", CultureInfo.InvariantCulture),
                olay = k.EventType.ToString(),
                basarili = k.Success,
                kullaniciId = k.UserId,
                // E-posta maskeli kaydediliyor; açık e-posta rapora sızmaz.
                eposta = k.Email,
                ip = k.IpAddress,
                gerekce = k.Reason ?? k.FailureReason,
            })).Append('\n');
        }
        return sb.ToString();
    }

    /// <summary>CSV özeti — sistem yöneticisinin Excel'de açıp okuyabileceği hâl.</summary>
    internal static string CsvOzeti(IReadOnlyList<AuthEvent> kayitlar)
    {
        var sb = new StringBuilder();
        sb.Append("Zaman;Olay;Basarili;KullaniciId;E-posta;IP;Gerekce\n");
        foreach (var k in kayitlar)
        {
            sb.Append(k.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)).Append(';');
            sb.Append(k.EventType).Append(';');
            sb.Append(k.Success ? "evet" : "hayir").Append(';');
            sb.Append(k.UserId ?? "").Append(';');
            sb.Append(CsvHucre(k.Email)).Append(';');
            sb.Append(CsvHucre(k.IpAddress)).Append(';');
            sb.Append(CsvHucre(k.Reason ?? k.FailureReason)).Append('\n');
        }
        return sb.ToString();
    }

    private static string CsvHucre(string? deger)
    {
        if (string.IsNullOrEmpty(deger)) return "";
        var temiz = deger.Replace('"', '\'').Replace('\n', ' ').Replace('\r', ' ');
        return temiz.Contains(';') ? "\"" + temiz + "\"" : temiz;
    }
}
