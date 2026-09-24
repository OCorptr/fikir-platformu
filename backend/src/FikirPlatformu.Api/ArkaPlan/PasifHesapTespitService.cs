using FikirPlatformu.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.ArkaPlan;

/// <summary>
/// Kullanılmayan hesapları tespit edip kilitleyen background job (plan §6.3).
/// 30 günde bir çalışır; 90 günden uzun süredir login olmayan hesapları kilitler.
/// LockoutEnd DateTimeOffset.MaxValue'e çekilir — kullanıcı tekrar giriş yapamaz.
/// Admin unlock yaptığında Login tekrar mümkün olur.
/// </summary>
public sealed class PasifHesapTespitService(
    IServiceProvider servisSaglayici,
    ILogger<PasifHesapTespitService> gunluk) : BackgroundService
{
    private static readonly TimeSpan CalismaAraligi = TimeSpan.FromDays(30);
    private static readonly TimeSpan HareketsizlikSiniri = TimeSpan.FromDays(90);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
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

            try { await Task.Delay(CalismaAraligi, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Tek bir pasif hesap tespit çalışması — test ve manuel tetikleme için public.</summary>
    public async Task<int> TekCalistirAsync(CancellationToken cancellationToken)
    {
        using var kapsam = servisSaglayici.CreateScope();
        var kullaniciYoneticisi = kapsam.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var veritabani = kapsam.ServiceProvider
            .GetRequiredService<FikirPlatformu.Infrastructure.Persistence.FikirPlatformuDbContext>();

        // Son başarılı login zamanı = AspNetUsers tablosunda SecurityStamp son değişim yok;
        // burada Identity'nin LoginProvider üzerinden manuel takibi yok. IdentityUser'da
        // yerleşik LastLoginDate yok, biz de bu yüzden Identity'nin "LastAccess" bilgisini
        // claim üzerinden değil, bağlı tablolar (Idea, Evaluation, AuthEvent) üzerinden
        // dolaylı hesaplıyoruz.
        //
        // Basitleştirme: Kullanıcının sahip olduğu AuthEvent kayıtları içinde en yeni
        // LoginSuccess zamanı son aktivite kabul edilir.
        var kesimTarihi = DateTime.UtcNow - HareketsizlikSiniri;
        var tumKullanicilar = await veritabani.Users.ToListAsync(cancellationToken);

        int kilitliSayi = 0;
        foreach (var kullanici in tumKullanicilar)
        {
            if (cancellationToken.IsCancellationRequested) break;
            if (kullanici.LockoutEnd.HasValue && kullanici.LockoutEnd.Value > DateTimeOffset.UtcNow)
                continue; // zaten kilitli

            // AuthEvent tablosundan son LoginSuccess zamanını bul.
            var sonAktivite = await veritabani.AuthEvents
                .Where(e => e.UserId == kullanici.Id
                    && e.EventType == FikirPlatformu.Domain.Auth.AuthEventType.LoginSuccess)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => (DateTime?)e.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            // Hiç login olmamış hesaplar için IdentityUser'da oluşturma tarihi yok;
            // güvenli tarafta kalmak için atlanır (yanlışlıkla yeni hesap kilitlenmesin).
            if (sonAktivite is null)
                continue;

            if (sonAktivite.Value < kesimTarihi)
            {
                var sonuc = await kullaniciYoneticisi.SetLockoutEndDateAsync(kullanici, DateTimeOffset.MaxValue);
                if (sonuc.Succeeded)
                {
                    kilitliSayi++;
                    gunluk.LogInformation("Pasif hesap kilitlendi: {Email} (son işlem: {Tarih:o})",
                        kullanici.Email, sonAktivite);
                }
            }
        }

        gunluk.LogInformation("PasifHesapTespitService: {Kilitli} hesap 90 gün hareketsizlik nedeniyle kilitlendi.", kilitliSayi);
        return kilitliSayi;
    }
}