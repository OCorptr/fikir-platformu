using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Herkese açık (kimlik doğrulaması gerektirmeyen) okuma uçları.
///
/// Sprint 11.92 — Ana sayfa gerçek veriye bağlandı. Önceki hâli 5 sahte kayıttı.
///
/// <para><b>Kural (Onur, 9 Eki 2026):</b> Her kategoriden 1 aday bakanlığa gider
/// (<c>period_selections</c>), bakanlık adaylar arasından <b>1 tanesini</b> seçer
/// (<c>period_winners</c>). <b>Anasayfada adaylar değil, sadece kazanan yayınlanır.</b>
/// Anasayfa aktif dönem + geçmiş 2 dönemin kazananlarını gösterir; "Ayın Fikri
/// Arşivi" ise tüm dönemlerin kazanan listesi döner.</para>
///
/// <para>Mevcut <c>/api/ministry/periods*</c> uçlarının hepsi <c>MinistryOnly</c>.
/// Ana sayfa anonim olduğu için ayrı bir kamu ucu gerekiyor.</para>
///
/// ⚠️ KVKK: Bu uç PII döndürür. Öğrenci adı soyadın YALNIZCA başharfi ile
/// maskelenir (<see cref="KisiselVeriYardimci.OgrenciAdiMaskele"/>); okul bilgisi
/// modelde bulunmadığından il adı gösterilir.
/// </summary>
public static class PublicEndpoints
{
    /// <summary>Kart alanı için fikir metnini kısaltır.</summary>
    private const int OzetKarakter = 240;

    private sealed record KazananKart(
        Guid FikirId,
        int KategoriId,
        string Kategori,
        string Il,
        string Ogrenci,
        string Fikir);

    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/public").WithTags("Herkese açık");

        // GET /api/public/ayin-fikirleri
        grup.MapGet("/ayin-fikirleri", async (
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            var simdi = DateTimeOffset.UtcNow;

            var donemler = await db.Periods.AsNoTracking()
                .OrderByDescending(p => p.StartAt)
                .Take(100)
                .ToListAsync(cancellationToken);

            if (donemler.Count == 0)
            {
                return Results.Ok(new
                {
                    aktifDonem = (object?)null,
                    donemler = Array.Empty<object>(),
                });
            }

            var kazananlar = await db.PeriodWinners.AsNoTracking()
                .ToDictionaryAsync(w => w.PeriodId, cancellationToken);

            var fikirIds = kazananlar.Values.Select(w => w.IdeaId).Distinct().ToList();
            var kartlar = await KazananKartlariniYukle(db, fikirIds, cancellationToken);

            var kayitlar = donemler.Select(d =>
            {
                var kazananKart = kazananlar.TryGetValue(d.Id, out var k) && kartlar.TryGetValue(k.IdeaId, out var kart)
                    ? kart
                    : (object?)null;
                return new
                {
                    id = d.Id,
                    etiket = d.Label,
                    baslangic = d.StartAt,
                    bitis = d.EndAt,
                    durum = d.Status.ToString(),
                    kazanan = kazananKart,
                    secimTarihi = kazananlar.TryGetValue(d.Id, out var k2) ? k2.SelectedAt : (DateTimeOffset?)null,
                };
            }).ToList();

            // İçinde bulunulan dönem: StartAt <= now < EndAt; yoksa en son dönem.
            var aktif = donemler.FirstOrDefault(p => p.StartAt <= simdi && simdi < p.EndAt)
                        ?? donemler[0];

            return Results.Ok(new
            {
                aktifDonem = new
                {
                    id = aktif.Id,
                    etiket = aktif.Label,
                    baslangic = aktif.StartAt,
                    bitis = aktif.EndAt,
                    durum = aktif.Status.ToString(),
                },
                // Tüm dönemler, en yeniden eskiye. Frontend ilk 3'ü anasayfada gösterir.
                donemler = kayitlar,
            });
        });

        return app;
    }

    private static async Task<Dictionary<Guid, KazananKart>> KazananKartlariniYukle(
        FikirPlatformuDbContext db,
        IReadOnlyList<Guid> fikirIds,
        CancellationToken cancellationToken)
    {
        var sonuc = new Dictionary<Guid, KazananKart>();
        if (fikirIds.Count == 0) return sonuc;

        var satirlar = await (
            from f in db.Ideas.AsNoTracking()
            where fikirIds.Contains(f.Id)
            join k in db.IdeaCategories.AsNoTracking() on f.CategoryId equals k.Id
            join il in db.Provinces.AsNoTracking() on f.ProvinceId equals il.Id
            select new { f.Id, f.StudentId, f.CategoryId, Kategori = k.Name, Il = il.Name, f.Content })
            .ToListAsync(cancellationToken);
        if (satirlar.Count == 0) return sonuc;

        // Öğrenci adı için AYRI sorgu: `Idea.StudentId` Guid, `ApplicationUser.Id`
        // string — LINQ join `(string)f.StudentId` SQL'e çevrilemiyor.
        var ogrenciIdleri = satirlar.Select(s => s.StudentId.ToString()).Distinct().ToList();
        var ogrenciler = await db.Users.AsNoTracking()
            .Where(u => ogrenciIdleri.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        foreach (var satir in satirlar)
        {
            if (!ogrenciler.TryGetValue(satir.StudentId.ToString(), out var ogrenci)) continue;
            sonuc[satir.Id] = new KazananKart(
                satir.Id,
                satir.CategoryId,
                satir.Kategori,
                satir.Il,
                // PII maskeli: "Emir K." (ad + soyad başharfi).
                KisiselVeriYardimci.OgrenciAdiMaskele(ogrenci.FirstName, ogrenci.LastName),
                Ozetle(satir.Content));
        }

        return sonuc;
    }

    private static string Ozetle(string? metin)
    {
        var s = (metin ?? "").Trim();
        return s.Length <= OzetKarakter ? s : s[..OzetKarakter].TrimEnd() + "…";
    }
}