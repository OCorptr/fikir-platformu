using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.ArkaPlan;

/// <summary>
/// Kullanılmayan hesapları tespit edip RAPORLAYAN ve pasife alan background job.
///
/// YEĞİTEK güvenlik gereksinimi (madde 39):
///   "Kullanılmayan hesaplar raporlanır ve pasife alınır."
///
/// Davranış:
///   - Hareketsizlik eşiğini aşan hesaplar kilitlenir (LockoutEnd = MaxValue).
///     Kullanıcı giriş yapamaz; yönetici bakım endpoint'i ile açabilir.
///   - Her işlem `AuthEvent` tablosuna `AccountDisabled` olarak yazılır —
///     yani kalıcı ve denetlenebilir bir kayıt.
///   - Ayrıca `PasifHesap` adlı bir rapor kaydı üretilir; yönetici bunu
///     `GET /api/admin/pasif-hesaplar` ucundan görebilir.
///
/// Güvenlik önlemleri (Sprint 11.53):
///   - Ayrıcalıklı roller (SystemAdmin, MinistryOfficial) ASLA otomatik kilitlenmez.
///     Aksi halde hiçbir yönetici sisteme giremez hale gelirdi.
///   - Hiç giriş kaydı olmayan hesaplar atlanır (yeni açılan hesap yanlışlıkla
///     kilitlenmesin).
///   - Servis `PasifHesap_Enabled=false` ile kapatılabilir.
///
/// Ayarlar (ortam değişkeni):
///   PasifHesap_Enabled      = true   (varsayılan)
///   PasifHesap_GunSayisi    = 90     (varsayılan)
///   PasifHesap_KontrolGunu = 30     (varsayılan: ne sıklıkla çalışsın)
/// </summary>
public sealed class PasifHesapTespitService(
    IServiceProvider servisSaglayici,
    IConfiguration yapilandirma,
    ILogger<PasifHesapTespitService> gunluk) : BackgroundService
{
    /// <summary>Otomatik kilitlemeden muaf tutulan roller.</summary>
    public static readonly string[] MuafRoller = ["SystemAdmin", "MinistryOfficial"];

    public static bool EtkinMi(IConfiguration cfg)
        => cfg.GetValue("PasifHesap:Enabled", true);

    public static int HareketsizlikGunu(IConfiguration cfg)
        => Math.Max(7, cfg.GetValue("PasifHesap:GunSayisi", 90));

    private static int KontrolGunu(IConfiguration cfg)
        => Math.Max(1, cfg.GetValue("PasifHesap:KontrolGunu", 30));

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!EtkinMi(yapilandirma))
        {
            gunluk.LogInformation("PasifHesapTespitService devre dışı (PasifHesap_Enabled=false).");
            return;
        }

        var aralik = TimeSpan.FromDays(KontrolGunu(yapilandirma));
        gunluk.LogInformation(
            "PasifHesapTespitService başladı. {Gun} gün hareketsizlik eşiği, {Aralik} günde bir kontrol.",
            HareketsizlikGunu(yapilandirma), KontrolGunu(yapilandirma));

        // İlk çalışmayı 10 dakika geciktir — sistem yüklendikten sonra çalışsın.
        try { await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TekCalistirAsync(stoppingToken); }
            catch (Exception hata) when (!stoppingToken.IsCancellationRequested)
            {
                gunluk.LogError(hata, "PasifHesapTespitService hata aldı.");
            }

            try { await Task.Delay(aralik, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>
    /// Tek bir pasif hesap kontrolü. Dönen sayı, bu çalışmada kilitlenen hesap adedidir.
    /// </summary>
    public async Task<int> TekCalistirAsync(CancellationToken cancellationToken)
    {
        using var kapsam = servisSaglayici.CreateScope();
        var kullaniciYoneticisi = kapsam.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var veritabani = kapsam.ServiceProvider.GetRequiredService<FikirPlatformuDbContext>();

        var gunSiniri = HareketsizlikGunu(yapilandirma);
        var kesimTarihi = DateTime.UtcNow.AddDays(-gunSiniri);

        var tumKullanicilar = await veritabani.Users.ToListAsync(cancellationToken);
        int kilitliSayi = 0;

        foreach (var kullanici in tumKullanicilar)
        {
            if (cancellationToken.IsCancellationRequested) break;

            // Zaten kilitli hesapları tekrar işlemeye gerek yok.
            if (kullanici.LockoutEnd.HasValue && kullanici.LockoutEnd.Value > DateTimeOffset.UtcNow)
                continue;

            // Ayrıcalıklı roller muaf — yönetici erişimi hiçbir zaman kesilmemeli.
            var roller = await kullaniciYoneticisi.GetRolesAsync(kullanici);
            if (roller.Any(r => MuafRoller.Contains(r)))
                continue;

            // Son aktivite = AuthEvent içindeki en yeni LoginSuccess.
            // Hiç giriş kaydı yoksa atlanır (yeni hesap yanlışlıkla kilitlenmesin).
            var sonAktivite = await veritabani.AuthEvents
                .Where(e => e.UserId == kullanici.Id
                    && e.EventType == AuthEventType.LoginSuccess)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => (DateTime?)e.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (sonAktivite is null) continue;
            if (sonAktivite.Value >= kesimTarihi) continue;

            var sonuc = await kullaniciYoneticisi.SetLockoutEndDateAsync(kullanici, DateTimeOffset.MaxValue);
            if (!sonuc.Succeeded) continue;

            // Denetim kaydı — YEĞİTEK madde 39 "raporlanır" gereksinimi.
            veritabani.AuthEvents.Add(new AuthEvent
            {
                UserId = kullanici.Id,
                Email = Endpoints.KisiselVeriYardimci.EmailMaskele(kullanici.Email),
                EventType = AuthEventType.AccountDisabled,
                Success = true,
                Reason = $"pasif_hesap_{gunSiniri}_gun",
                FailureReason = null,
                CreatedAt = DateTime.UtcNow,
                IpAddress = "sistem",
            });
            await veritabani.SaveChangesAsync(cancellationToken);

            kilitliSayi++;
            gunluk.LogInformation(
                "Pasif hesap pasife alındı: {Email} (son giriş: {Tarih:o})",
                Endpoints.KisiselVeriYardimci.EmailMaskele(kullanici.Email), sonAktivite);
        }

        gunluk.LogInformation(
            "PasifHesapTespitService tamamlandı: {Adet} hesap {Gun} gün hareketsizlik nedeniyle pasife alındı.",
            kilitliSayi, gunSiniri);
        return kilitliSayi;
    }
}
