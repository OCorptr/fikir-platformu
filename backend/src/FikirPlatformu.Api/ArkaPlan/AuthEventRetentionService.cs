using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.ArkaPlan;

/// <summary>
/// Kimlik doğrulama olayları için retention job (plan §1.7 — 2 yıl).
/// 24 saatte bir çalışır; 730 günden eski auth_events kayıtlarını siler.
/// Production'da Windows Service / Linux systemd / PM2 altında çalışacak şekilde
/// IHostedService olarak tasarlandı; geliştirme ortamında da otomatik çalışır.
/// </summary>
public sealed class AuthEventRetentionService(
    IServiceProvider servisSaglayici,
    ILogger<AuthEventRetentionService> gunluk) : BackgroundService
{
    private static readonly TimeSpan CalismaAraligi = TimeSpan.FromHours(24);
    private static readonly TimeSpan EskiKayitSiniri = TimeSpan.FromDays(730); // 2 yıl

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // İlk çalıştırmayı 5 dakika geciktir — uygulama soğuk başlangıçta DB yükü bindirmesin.
        try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var kapsam = servisSaglayici.CreateScope();
                var veritabani = kapsam.ServiceProvider.GetRequiredService<FikirPlatformuDbContext>();
                var kesimTarihi = DateTime.UtcNow - EskiKayitSiniri;
                var silinen = await veritabani.AuthEvents
                    .Where(e => e.CreatedAt < kesimTarihi)
                    .ExecuteDeleteAsync(stoppingToken);
                if (silinen > 0)
                    gunluk.LogInformation("AuthEventRetentionService: {Silinen} eski kayıt silindi (kesim: {Tarih:o})", silinen, kesimTarihi);
            }
            catch (Exception hata) when (!stoppingToken.IsCancellationRequested)
            {
                gunluk.LogError(hata, "AuthEventRetentionService hata aldı, bir sonraki döngüde tekrar denenecek.");
            }

            try { await Task.Delay(CalismaAraligi, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }
}