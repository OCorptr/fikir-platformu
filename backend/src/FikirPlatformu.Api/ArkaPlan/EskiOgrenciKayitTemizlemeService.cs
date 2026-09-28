// Eski öğrenci kayıt temizleme — Sprint 11.30 KVKK.
//
// Onur: "9. sınıfta kayıt olan öğrenci mesela 12. sınıf bitince sadece
// kayıt bilgisi silinebilir artık sisteme girmesine gerek olmıycak."
//
// Background job: yılda bir kez çalışır; 4+ yıl önce oluşturulmuş Student
// rolündeki kullanıcıları Identity framework üzerinden hard delete eder.
// Identity FK CASCADE ile StudentProfile, AspNetUserRoles, AspNetUserClaims,
// AspNetUserLogins, AspNetUserTokens otomatik silinir. Ideas (StudentProfile
// üzerinden), IdeaReadReceipts (UserId), AuthEvents (UserId), PeriodSelections,
// ImplementationReports için de cascade temizlik tanımlı.
//
// KVKK log: silinen her öğrenci için AuthEvent (event_type=KvkkRetentionApplied,
// reason=eski-ogrenci-kayit-temizleme, email masked) yazılır — denetim için.

using FikirPlatformu.Domain.Auth;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using FikirPlatformu.Infrastructure.Security;
using FikirPlatformu.Api.Endpoints;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.ArkaPlan;

public sealed class EskiOgrenciKayitTemizlemeService(
    IServiceProvider servisSaglayici,
    ILogger<EskiOgrenciKayitTemizlemeService> gunluk) : BackgroundService
{
    /// <summary>Çalışma aralığı: 365 gün (yılda bir).</summary>
    private static readonly TimeSpan CalismaAraligi = TimeSpan.FromDays(365);

    /// <summary>Eski kayıt sınırı: 4 yıl (1460 gün). 9. sınıfta kayıt → 12. sınıf sonrası 1 yıl daha.</summary>
    private static readonly TimeSpan EskiKayitSiniri = TimeSpan.FromDays(365 * 4);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // İlk çalıştırmayı 5 dakika geciktir — uygulama soğuk başlangıçta DB yükü bindirmesin.
        try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
        catch (OperationCanceledException) { return; }

        // Sprint 11.32: Defansif tek-çalışma — eğer herhangi bir adımda hata
        // olursa DB'ye karışmadan çık. Böylece diğer background job'lar (auth
        // event retention) ve ana uygulama etkilenmez.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TekCalisma(stoppingToken);
            }
            catch (Exception hata) when (!stoppingToken.IsCancellationRequested)
            {
                gunluk.LogError(hata, "EskiOgrenciKayitTemizlemeService hata aldı, bir sonraki döngüde tekrar denenecek.");
            }
            catch (Exception hata)
            {
                // stoppingToken iptal edilmiş durumda da logla (sessizce yutma).
                gunluk.LogWarning(hata, "EskiOgrenciKayitTemizlemeService son hata (stopping token iptal).");
                return;
            }

            try { await Task.Delay(CalismaAraligi, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task TekCalisma(CancellationToken cancellationToken)
    {
        using var kapsam = servisSaglayici.CreateScope();
        var veritabani = kapsam.ServiceProvider.GetRequiredService<FikirPlatformuDbContext>();
        var kullaniciYoneticisi = kapsam.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        // "Student" rolü Identity AspNetRoles tablosunda — rol Id'sini bul.
        var studentRolId = await veritabani.Roles
            .Where(r => r.Name == "Student")
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (string.IsNullOrEmpty(studentRolId))
        {
            gunluk.LogWarning("EskiOgrenciKayitTemizlemeService: 'Student' rolü bulunamadı, çalışma atlandı.");
            return;
        }

        var kesimTarihi = DateTime.UtcNow - EskiKayitSiniri;

        // 4+ yıl önce ilk login olan Student rolündeki user Id'leri.
        // (Identity AspNetUsers tablosunda CreatedAt yok; AuthEvents'tan ilk event tarihini al.)
        var eskiStudentIdleri = await (
            from ur in veritabani.UserRoles
            where ur.RoleId == studentRolId
            join ilkEvent in (
                from e in veritabani.AuthEvents
                group e by e.UserId into g
                select new { UserId = g.Key!, IlkTarih = g.Min(x => x.CreatedAt) }
            ) on ur.UserId equals ilkEvent.UserId
            where ilkEvent.IlkTarih < kesimTarihi
            select ur.UserId
        ).Distinct().ToListAsync(cancellationToken);

        if (eskiStudentIdleri.Count == 0)
        {
            gunluk.LogDebug("EskiOgrenciKayitTemizlemeService: temizlenecek eski öğrenci kaydı yok (kesim: {Tarih:o}).", kesimTarihi);
            return;
        }

        gunluk.LogInformation("EskiOgrenciKayitTemizlemeService: {Adet} eski öğrenci kaydı temizlenecek (kesim: {Tarih:o}).",
            eskiStudentIdleri.Count, kesimTarihi);

        var basarili = 0;
        var basarisiz = 0;

        foreach (var userId in eskiStudentIdleri)
        {
            if (cancellationToken.IsCancellationRequested) break;

            var kullanici = await kullaniciYoneticisi.FindByIdAsync(userId);
            if (kullanici is null) continue;

            var emailMaskeli = KisiselVeriYardimci.EmailMaskele(kullanici.Email);

            // Identity framework hard delete — FK CASCADE ile bağlı tablolar silinir.
            var sonuc = await kullaniciYoneticisi.DeleteAsync(kullanici);
            if (sonuc.Succeeded)
            {
                basarili++;
                var ilkTarih = await veritabani.AuthEvents
                    .Where(e => e.UserId == userId)
                    .OrderBy(e => e.CreatedAt)
                    .Select(e => (DateTime?)e.CreatedAt)
                    .FirstOrDefaultAsync(cancellationToken);
                veritabani.AuthEvents.Add(new AuthEvent
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Email = emailMaskeli,
                    IpAddress = "system",
                    UserAgent = "EskiOgrenciKayitTemizlemeService",
                    EventType = AuthEventType.KvkkRetentionApplied,
                    Success = true,
                    FailureReason = $"eski-ogrenci-kayit-temizleme;ilk-login={ilkTarih:o};kesim={kesimTarihi:o}",
                    CreatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                basarisiz++;
                var hataDetay = string.Join("; ", sonuc.Errors.Select(e => $"{e.Code}={e.Description}"));
                gunluk.LogWarning("EskiOgrenciKayitTemizlemeService: öğrenci silinemedi UserId={UserId}, Hata={Hata}", userId, hataDetay);
            }
        }

        try
        {
            await veritabani.SaveChangesAsync(cancellationToken);
            gunluk.LogInformation("EskiOgrenciKayitTemizlemeService: tamamlandı. Başarılı={Basarili}, Başarısız={Basarisiz}, Audit log={AuditLog} satır.",
                basarili, basarisiz, basarili);
        }
        catch (Exception ex)
        {
            gunluk.LogError(ex, "EskiOgrenciKayitTemizlemeService: audit log kaydedilemedi, ama Identity delete başarılı olabilir.");
        }
    }
}
