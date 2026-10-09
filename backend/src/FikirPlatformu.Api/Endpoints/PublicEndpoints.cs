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
    private sealed record KazananKart(
        Guid FikirId,
        int KategoriId,
        string Kategori,
        string Il,
        string Ogrenci,
        string Fikir);

    public static IEndpointRouteBuilder MapPublicEndpoints(this IEndpointRouteBuilder app)
    {
        // Sprint 11.92: fail-closed politikası nedeniyle AÇIK — ana sayfa
        // herkese açık ve kimlik gerektirmiyor.
        var grup = app.MapGroup("/api/public").WithTags("Herkese açık").AllowAnonymous();

        // GET /api/public/ayin-fikirleri
        grup.MapGet("/ayin-fikirleri", async (
            HttpContext http,
            IConfiguration yapilandirma,
            FikirPlatformuDbContext db,
            CancellationToken cancellationToken) =>
        {
            try
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

            // ===== Sprint 11.92 — YAYIM AÇIK RIZASI KAPISI =====
            // KVKK Kurul 01.07.2026 tarihli 2026/1301 sayılı kararı: internet
            // ortamında paylaşılan kişisel veri gerçerli bir işleme şartına
            // dayanmalı ve "amaçla bağlantılı, sınırlı ve ölçülü" olmalıdır.
            // Kayıt sırasında YAYIM açık rızası VERİLMEMİŞ öğrencinin fikri
            // ana sayfada yayımlanmaz — fikir yine değerlendirilir, sadece kamuya
            // açık kartta görünmez.
            var rizaVerenler = (await db.Database
                .SqlQueryRaw<string>(
                    // ⚠️ İki tuzak bir arada:
                    //   1) EF skaler sorguyu `s.value` diye sarar → kolon adı `value`
                    //      olmalı (yoksa "Unknown column 's.value'").
                    //   2) Pomelo `CHAR(36)` kolonu Guid olarak döndürüyor →
                    //      `InvalidCastException: Guid → String`. CAST ile metne
                    //      çeviriyoruz.
                    "SELECT DISTINCT CAST(user_id AS CHAR(36)) AS value FROM kvkk_rizalari " +
                    "WHERE tur = 'yayim' AND iptal_at IS NULL")
                .ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            // TÜM kazananlar döner (seçim bilgisi bozulmaz); yayım kartı yalnızca
            // rıza verilmişse eklenir. Aksi hâlde "kazanan seçildi ama gösterilmiyor"
            // durumunda sayfa "değerlendirme sürüyor" deyip yanlış bilgi verirdi.
            var kazananlar = await db.PeriodWinners.AsNoTracking()
                .GroupBy(w => w.PeriodId)
                .Select(g => g.First())
                .ToDictionaryAsync(w => w.PeriodId, cancellationToken);

            var fikirIds = kazananlar.Values.Select(w => w.IdeaId).Distinct().ToList();
            var kartlar = await KazananKartlariniYukle(db, fikirIds, cancellationToken);

            // Yayım izni olmayan fikirlerin kartı gösterilmez.
            var yayimliKartIdler = new HashSet<Guid>();
            if (kartlar.Count > 0 && rizaVerenler.Count > 0)
            {
                // ⚠️ `kartlar.ContainsKey(...)` EF'e ÇEVRİLEMEZ (runtime hatası) —
                // anahtarları listeye alıp Contains kullanıyoruz.
                var kartIdleri = kartlar.Keys.ToList();
                var profilIdler = await db.Ideas.AsNoTracking()
                    .Where(f => kartIdleri.Contains(f.Id))
                    .Select(f => f.StudentId)
                    .ToListAsync(cancellationToken);
                if (profilIdler.Count > 0)
                {
                    var rizaVerenProfiller = await db.StudentProfiles.AsNoTracking()
                        .Where(p => rizaVerenler.Contains(p.ApplicationUserId) && profilIdler.Contains(p.Id))
                        .Select(p => p.Id)
                        .ToListAsync(cancellationToken);
                    if (rizaVerenProfiller.Count > 0)
                    {
                        yayimliKartIdler = (await db.Ideas.AsNoTracking()
                            .Where(f => rizaVerenProfiller.Contains(f.StudentId))
                            .Select(f => f.Id)
                            .ToListAsync(cancellationToken))
                            .ToHashSet();
                    }
                }
            }

            var kayitlar = donemler.Select(d =>
            {
                var kazananKart = kazananlar.TryGetValue(d.Id, out var k)
                    && yayimliKartIdler.Contains(k.IdeaId)
                    && kartlar.TryGetValue(k.IdeaId, out var kart)
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
                    // Kazanan seçilmiş AMA yayım izni yok → kullanıcıya "yok" deme.
                    kazananSecildi = kazananlar.ContainsKey(d.Id),
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
            }
            catch (Exception ex)
            {
                // Teşhis: hata metni YALNIZCA bakım anahtarı doğruysa döner.
                var tanili = BakimGizliAnahtar.Gecerli(http, yapilandirma);
                return Results.Json(new
                {
                    message = "Beklenmeyen bir hata oluştu.",
                    hataTipi = tanili ? ex.GetType().Name : null,
                    hataMesaji = tanili ? KisaHata(ex) : null,
                }, statusCode: 500);
            }
        });

        return app;
    }

    /// <summary>En içteki istisna mesajı (teşhis amaçlı, uzunluk sınırlı).</summary>
    private static string KisaHata(Exception ex)
    {
        var kok = ex;
        while (kok.InnerException is not null) kok = kok.InnerException;
        var m = kok.Message;
        return m.Length <= 350 ? m : m[..350] + "…";
    }

    private static async Task<Dictionary<Guid, KazananKart>> KazananKartlariniYukle(        FikirPlatformuDbContext db,
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
            join sp in db.StudentProfiles.AsNoTracking() on f.StudentId equals sp.Id
            select new { f.Id, KullaniciId = sp.ApplicationUserId, f.CategoryId, Kategori = k.Name, Il = il.Name, f.Content })
            .ToListAsync(cancellationToken);
        if (satirlar.Count == 0) return sonuc;

        // Öğrenci adı için AYRI sorgu. ⚠️ `Idea.StudentId` bir **StudentProfile.Id**
        //'dir (FK: ideas.student_id → student_profiles.id), ApplicationUser.Id
        // DEĞİL — önce profile, sonra profile.ApplicationUserId ile kullanıcıya gidilir.
        var ogrenciIdleri = satirlar.Select(s => s.KullaniciId).Distinct().ToList();
        var ogrenciler = await db.Users.AsNoTracking()
            .Where(u => ogrenciIdleri.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        foreach (var satir in satirlar)
        {
            if (!ogrenciler.TryGetValue(satir.KullaniciId, out var ogrenci)) continue;
            sonuc[satir.Id] = new KazananKart(
                satir.Id,
                satir.CategoryId,
                satir.Kategori,
                satir.Il,
                // PII maskeli: "Emir K." (ad + soyad başharfi).
                KisiselVeriYardimci.OgrenciAdiMaskele(ogrenci.FirstName, ogrenci.LastName),
                // ⚠️ Sprint 11.92: Önceden 240 karakterde kırpılıyordu; lightbox
                // (büyütme) ekranı da aynı veriyi gösterdiği için TAM METİN
                // hiçbir yerde görünmüyordu. Kırpma artık arayüzde yapılıyor.
                satir.Content ?? "");
        }

        return sonuc;
    }
}