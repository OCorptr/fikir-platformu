using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Herkese açık (kimlik doğrulaması gerektirmeyen) okuma uçları.
///
/// Sprint 11.92 — Ana sayfadaki "Ayın Fikirleri" karuseli tamamen sahte veriyle
/// çalışıyordu (`HomePage.tsx` içinde 5 sabit nesne, ay etiketleri kodda yazılı).
/// Gerçek veri modeli ise iki kademeli:
///   1. `period_selections` — her kategoriden en fazla 1 aday (İl AR-GE → bakanlık)
///   2. `period_winners`   — bakanlığın adaylar içinden seçtiği tek kazanan
///
/// Mevcut `/api/ministry/periods*` uçlarının hepsi `MinistryOnly`. Ana sayfa
/// anonim olduğu için ayrı bir kamu ucu gerekiyor.
///
/// ⚠️ KVKK: Bu uç PII döndürür. Öğrenci adı soyadın YALNIZCA başharfi ile
/// maskelenir (<see cref="KisiselVeriYardimci.OgrenciAdiMaskele"/>) ve okul
/// bilgisi modelde bulunmadığından il adı gösterilir.
/// </summary>
public static class PublicEndpoints
{
    /// <summary>Kart alanı için fikir metnini kısaltır.</summary>
    private const int OzetKarakter = 240;

    private sealed record AdayKart(
        Guid PeriodId,
        Guid FikirId,
        int KategoriId,
        string Kategori,
        string Il,
        string Ogrenci,
        string Fikir,
        DateTimeOffset SecimTarihi);

    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/public").WithTags("Herkese açık");

        // GET /api/public/ayin-fikirleri
        grup.MapGet("/ayin-fikirleri", async (
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            var simdi = DateTimeOffset.UtcNow;

            // Son 24 dönem; dönemler 3 aylık (plan §25).
            var donemler = await db.Periods.AsNoTracking()
                .OrderByDescending(p => p.StartAt)
                .Take(24)
                .ToListAsync(cancellationToken);

            if (donemler.Count == 0)
            {
                // Hiç dönem yok — sahte veri göstermek yerine dürüst boş durum.
                return Results.Ok(new
                {
                    donem = (object?)null,
                    adaylar = Array.Empty<object>(),
                    kazananFikirId = (Guid?)null,
                    arsiv = Array.Empty<object>(),
                });
            }

            // İçinde bulunulan dönem: StartAt <= now < EndAt. Yoksa en son dönem.
            var aktif = donemler.FirstOrDefault(p => p.StartAt <= simdi && simdi < p.EndAt)
                        ?? donemler[0];

            var arsivDonemleri = donemler.Where(d => d.Id != aktif.Id).ToList();
            var ilgiliDonemler = new List<Guid> { aktif.Id };
            ilgiliDonemler.AddRange(arsivDonemleri.Select(d => d.Id));

            var kartlar = await AdayKartlariniYukle(db, ilgiliDonemler, cancellationToken);

            var kazananlar = await db.PeriodWinners.AsNoTracking()
                .Where(w => ilgiliDonemler.Contains(w.PeriodId))
                .ToListAsync(cancellationToken);

            var arsiv = arsivDonemleri.Select(d =>
            {
                var kazananFikirId = kazananlar
                    .FirstOrDefault(w => w.PeriodId == d.Id)?.IdeaId;
                var kart = kazananFikirId is null
                    ? null
                    : kartlar.FirstOrDefault(k => k.PeriodId == d.Id && k.FikirId == kazananFikirId);
                return new
                {
                    id = d.Id,
                    etiket = d.Label,
                    baslangic = d.StartAt,
                    bitis = d.EndAt,
                    kazanan = kart,
                };
            }).ToList();

            return Results.Ok(new
            {
                donem = new
                {
                    id = aktif.Id,
                    etiket = aktif.Label,
                    baslangic = aktif.StartAt,
                    bitis = aktif.EndAt,
                    durum = aktif.Status.ToString(),
                },
                adaylar = kartlar.Where(k => k.PeriodId == aktif.Id).ToList(),
                kazananFikirId = kazananlar.FirstOrDefault(w => w.PeriodId == aktif.Id)?.IdeaId,
                arsiv,
            });
        });

        return app;
    }

    /// <summary>Verilen dönemlerin tüm kategori adaylarını kart listesi olarak yükler.</summary>
    private static async Task<List<AdayKart>> AdayKartlariniYukle(
        FikirPlatformuDbContext db,
        IReadOnlyList<Guid> periodIds,
        CancellationToken cancellationToken)
    {
        var secimler = await db.PeriodSelections.AsNoTracking()
            .Where(s => periodIds.Contains(s.PeriodId))
            .ToListAsync(cancellationToken);
        if (secimler.Count == 0) return [];

        var fikirIds = secimler.Select(s => s.IdeaId).ToList();

        // Öğrenci adı için AYRI sorgu: `Idea.StudentId` Guid, `ApplicationUser.Id`
        // string — LINQ join `(string)f.StudentId` SQL'e çevrilemiyor.
        // Bu yüzden önce fikir satırları, sonra öğrenci künyesi çekilip
        // bellekte eşleştiriliyor.
        var satirlar = await (
            from f in db.Ideas.AsNoTracking()
            where fikirIds.Contains(f.Id)
            join k in db.IdeaCategories.AsNoTracking() on f.CategoryId equals k.Id
            join il in db.Provinces.AsNoTracking() on f.ProvinceId equals il.Id
            select new
            {
                f.Id,
                f.StudentId,
                Kategori = k.Name,
                Il = il.Name,
                f.Content,
            })
            .ToListAsync(cancellationToken);

        var ogrenciIdleri = satirlar.Select(s => s.StudentId.ToString()).Distinct().ToList();
        var ogrenciler = await db.Users.AsNoTracking()
            .Where(u => ogrenciIdleri.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var sonuc = new List<AdayKart>(secimler.Count);
        foreach (var secim in secimler)
        {
            var satir = satirlar.FirstOrDefault(s => s.Id == secim.IdeaId);
            if (satir is null) continue;
            if (!ogrenciler.TryGetValue(satir.StudentId.ToString(), out var ogrenci)) continue;

            sonuc.Add(new AdayKart(
                secim.PeriodId,
                satir.Id,
                secim.CategoryId,
                satir.Kategori,
                satir.Il,
                // PII maskeli: "Emir K." (ad + soyad başharfi).
                KisiselVeriYardimci.OgrenciAdiMaskele(ogrenci.FirstName, ogrenci.LastName),
                Ozetle(satir.Content),
                secim.SelectedAt));
        }

        return sonuc;
    }

    private static string Ozetle(string? metin)
    {
        var s = (metin ?? "").Trim();
        return s.Length <= OzetKarakter ? s : s[..OzetKarakter].TrimEnd() + "…";
    }
}