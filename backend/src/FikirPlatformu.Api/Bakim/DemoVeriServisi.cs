using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Identity;
using FikirPlatformu.Domain.Ministry;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using FikirPlatformu.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Api.Bakim;

/// <summary>
/// Sprint 11.92 — Uçtan uca demo verisi üreteci.
///
/// <para><b>Ne yapar:</b> Mevcut 3 aylık dönemlerin (2026 I–IV) her biri için
/// 10 kategoriden birer fikir üretir, öğrenci → değerlendirme → il onayı →
/// bakanlık adayı → dönem kazananı zincirini GERÇEK domain metotlarıyla yürütür.
/// Böylece ana sayfa, arşiv, bakanlık aday havuzu, il gelen kutusu ve
/// değerlendirme ekranı birbirine gerçekten bağlı çalışır.</para>
///
/// <para><b>Akış (domain metotlarıyla, durum atlamadan):</b>
/// <c>CreateDraft → Submit → MoveToInEvaluation → CompleteEvaluation → Approve
/// → (bakanlık adayı) Plan</c></para>
///
/// <para><b>Güvenlik:</b> Şifre koda GÖMÜLMEZ — her çalıştırmada rastgele
/// üretilir ve YALNIZCA yanıtta bir kez döner (proje kuralı: hiçbir gizli
/// değer repoda). Kullanıcı adları `demo.` önekiyle işaretlenir, temizleme
/// ucu bunları tanır.</para>
///
/// <p><b>Idempotent:</b> `demo.` önekli bir kullanıcı varsa hiçbir şey
/// yapılmaz, mevcut durum raporlanır.</p>
/// </summary>
public static class DemoVeriServisi
{
    public const string KullaniciOneki = "demo.";

    /// <summary>Demo öğrenci sayısı (fikirler bu havuzdan dağıtılır).</summary>
    private const int OgrenciSayisi = 20;

    /// <summary>Her fikir kaç değerlendirici tarafından puanlansın.</summary>
    private const int DegerlendiriciSayisi = 2;

    /// <summary>Kategori başına, dönem başına üretilen fikir sayısı.</summary>
    private const int DonemBasinaKategoriFikri = 2;

    private static readonly string[] Adlar =
    [
        "Elif", "Mert", "Zeynep", "Arda", "Emir", "Defne", "Kaan", "İrem",
        "Yusuf", "Melis", "Berat", "Sude", "Alp", "Ecrin", "Onur", "Nehir",
        "Doruk", "Ayla", "Umut", "Selin",
    ];

    private static readonly string[] Soyadlar =
    [
        "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım",
        "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan",
        "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
    ];

    private static readonly string[] Okullar =
    [
        "Cumhuriyet Ortaokulu", "Atatürk Lisesi", "Mimar Sinan İlkokulu",
        "Gazipaşa Ortaokulu", "Yavuz Selim Anadolu Lisesi", "Fatih Ortaokulu",
        "Barbaros İlkokulu", "İstiklal Lisesi",
    ];

    /// <summary>Kategori adı → o kategoriye ait gerçekçi fikir şablonları.</summary>
    private static readonly Dictionary<string, string[]> KategoriFikirleri = new()
    {
        ["Kültür ve Sanat"] =
        [
            "Okul bahçemizde açık hava sinema etkinliği başlatalım; öğrenciler kendi kısa filmlerini göstersin.",
            "Kütüphanemize bir dijital sanat atölyesi ekleyelim; tabletlerle çizim ve animasyon yapılsın.",
        ],
        ["Spor ve Sağlıklı Yaşam"] =
        [
            "Okul bahçesine koşu parkuru çizelim ve haftalık öğrenci koşusu düzenleyelim.",
            "Sınıflara su içme hatırlatıcı panolar asıp düzenli su tüketimi takibi yapalım.",
        ],
        ["Bilim ve Teknoleji"] =
        [
            "Laboratuvarımıza küçük bir teleskop alıp gökyüzü geceleri düzenleyelim.",
            "Okul bahçesine hava kalitesi ölçen bir istasyon kurup verileri panoda yayınlayalım.",
        ],
        ["Yapay Zekâ"] =
        [
            "Yapay zekâ destekli bir çalışma arkadaşımız olsun; zorlandığımız konuları seviyemize göre anlatsın.",
            "Sınıf panolarına yapay zekâ tabanlı bir soru-cevap asıp öğrencilerin merak ettiklerini yanıtlayalım.",
        ],
        ["Çevre ve Sürdürülebilirlik"] =
        [
            "Atık yağları toplayıp atölyede sabun üreten bir proje kurup geliri okul kütüphanesine ayıralım.",
            "Bahçemizdeki atıkları ayırma noktaları oluşturalım; geri dönüşüm farkındalığı artırsın.",
        ],
        ["Sosyal Sorumluluk"] =
        [
            "Huzurevinde yaşayan büyüklerimize düzenli mektup yazıp ziyaret edelim.",
            "Mahalledeki ihtiyaç sahiplerine gıda ve kıyafet yardımı toplayalım.",
        ],
        ["Girişimcilik"] =
        [
            "Öğrencilerin okul atölyesinde ürettiği ürünleri bir kooperatif aracılığıyla satıp geliri paylaşalım.",
            "Küçük bütçeli bir girişimcilik atölyesi düzenleyip fikirden ürüne kadar süreci yaşatalım.",
        ],
        ["Afet Farkındalığı ve Güvenli Yaşam"] =
        [
            "Her sınıfa deprem ve yangın tatbikatı yaptıralım; toplanma alanlarını birlikte işaretleyelim.",
            "İlk yardım eğitimi alalım; sınıflarımızda ilk yardım çantası bulunduralım.",
        ],
        ["Değerler Eğitimi"] =
        [
            "Sınıflar arası iyilik kartı turnuvası düzenleyelim; kazanan sınıf sinema günü kazansın.",
            "Gönüllülük haftasında okul bahçesini birlikte temizleyip ağaç dikelim.",
        ],
        ["Yerli ve Millî Üretim – Millî Savunma"] =
        [
            "Yerli teknoloji firmalarını okulumuza davet edip öğrencilerle buluşturalım.",
            "Millî savunma teknolojilerini anlatan bir konuşma ve sergi düzenleyelim.",
        ],
    };

    private static readonly string[] OkulYorumlari =
    [
        "Öğrenci dostu, uygulanabilir.",
        "Kaynakları okul bütçesine uygun.",
        "Birçok okulda tekrar edilebilir.",
        "Sürdürülebilir bir ekip kurulabilir.",
    ];

    public static async Task<object> Uret(
        IServiceProvider servisler,
        bool temizle,
        CancellationToken cancellationToken)
    {
        using var kapsam = servisler.CreateScope();
        var sp = kapsam.ServiceProvider;
        var db = sp.GetRequiredService<FikirPlatformuDbContext>();
        var um = sp.GetRequiredService<UserManager<ApplicationUser>>();
        var rm = sp.GetRequiredService<RoleManager<IdentityRole>>();

        // Hata olursa hangi ADIM'da olduğumuzu bilelim (mesaj sızdırmadan).
        var adim = "başlatma";
        try
        {
            return await UretIc(adim);
        }
        catch (Exception ex)
        {
            throw new DemoSeedAdimException(adim, ex);
        }

        async Task<object> UretIc(string adim)
        {
        var mevcutDemo = await db.Users.AnyAsync(u => (u.Email ?? "").StartsWith(KullaniciOneki), cancellationToken);

        // Sprint 11.92 düzeltme: `temizle=true` iken erken DÖNMEMELİ — aksi halde
        // temizleme hiç çalışmıyor ve yarım kalan veri (1 öğrenci) kilitli kalıyordu.
        if (mevcutDemo && !temizle)
        {
            return new
            {
                calistirildi = false,
                sebep = $"'{KullaniciOneki}' önekli demo kullanıcıları zaten var. Temizlemeden tekrar çalıştırılmaz.",
                ogrenci = await db.Users.CountAsync(u => (u.Email ?? "").StartsWith(KullaniciOneki + "ogrenci"), cancellationToken),
            };
        }

        if (temizle)
        {
            adim = "demo verilerini temizleme";
            await DemoVeriTemizle(db, um, cancellationToken);
        }

        adim = "rolleri oluşturma";
        // ---- Roller (yoksa oluştur) ----
        foreach (var rol in new[] { "Student", "ProvinceEvaluator", "ProvinceManager", "MinistryOfficial", "SystemAdmin" })
        {
            if (!await rm.RoleExistsAsync(rol)) await rm.CreateAsync(new IdentityRole(rol));
        }

        var kategoriler = await db.IdeaCategories.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.Id).ToListAsync(cancellationToken);
        var iller = await db.Provinces.AsNoTracking().OrderBy(p => p.Id).ToListAsync(cancellationToken);
        var donemler = await db.Periods.AsNoTracking().OrderByDescending(p => p.StartAt).Take(4).ToListAsync(cancellationToken);

        if (kategoriler.Count == 0 || iller.Count == 0 || donemler.Count == 0)
        {
            return new
            {
                calistirildi = false,
                sebep = "Ön koşul eksik.",
                kategoriSayisi = kategoriler.Count,
                ilSayisi = iller.Count,
                donemSayisi = donemler.Count,
            };
        }

        // ---- Demo parolası: kodda YOK, her çalıştırmada rastgele üretilir ----
        var sifre = RastgeleSifreUret();

        adim = "öğrenci hesaplarını oluşturma";
        // ---- Öğrenciler ----
        var ogrenciler = new List<ApplicationUser>();
        for (var i = 0; i < OgrenciSayisi; i++)
        {
            var il = iller[i % iller.Count];
            var email = $"{KullaniciOneki}ogrenci{i + 1:00}@demo.local";
            var ogrenci = await KullaniciOlustur(
                um, email, sifre, $"{Adlar[i % Adlar.Length]} {Soyadlar[(i * 7) % Soyadlar.Length]}");

            db.StudentProfiles.Add(new StudentProfile
            {
                Id = Guid.NewGuid(),
                ApplicationUserId = ogrenci.Id,
                ProvinceId = il.Id,
                School = Okullar[i % Okullar.Length],
                Grade = 7 + (i % 6),
                StudentNumber = $"2026{(i + 1):0000}",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
            ogrenciler.Add(ogrenci);
        }

        adim = "değerlendirici ve il yöneticisi hesaplarını oluşturma";
        // ---- Değerlendiriciler (her ile 1 değerlendirici + 1 yönetici) ----
        var degerlendiriciler = new Dictionary<int, List<ApplicationUser>>();
        for (var i = 0; i < iller.Count; i++)
        {
            var il = iller[i];
            var liste = new List<ApplicationUser>();
            for (var r = 1; r <= DegerlendiriciSayisi; r++)
            {
                var email = $"{KullaniciOneki}degerlendirici{il.Id:000}-{r}@demo.local";
                var u = await KullaniciOlustur(
                    um, email, sifre, $"Değerlendirici {(i + 1):00}-{r}");
                await um.AddToRoleAsync(u, "ProvinceEvaluator");
                liste.Add(u);
            }
            var yonetici = await KullaniciOlustur(
                um, $"{KullaniciOneki}yonetici{il.Id:000}@demo.local", sifre, $"İl Yöneticisi {(i + 1):00}");
            await um.AddToRoleAsync(yonetici, "ProvinceManager");
            db.ProvinceUserAssignments.Add(ProvinceUserAssignment.Create(
                yonetici.Id, il.Id, "ProvinceManager", "demo-seed", DateTimeOffset.UtcNow));
            degerlendiriciler[il.Id] = liste;
        }

        // ---- Bakanlık yetkilisi (kazanan seçimi denetim kaydı için) ----
        var bakanlik = await KullaniciOlustur(
            um, $"{KullaniciOneki}bakanlik@demo.local", sifre, "Bakanlık Temsilcisi");
        await um.AddToRoleAsync(bakanlik, "MinistryOfficial");
        adim = "veritabanına kaydetme";
        await db.SaveChangesAsync(cancellationToken);

        adim = "fikir, değerlendirme ve kazanan üretme";
        // ---- Fikirler: her dönem × her kategori ----
        var fikirSayisi = 0;
        var adaySayisi = 0;
        var ogrenciSira = 0;

        foreach (var donem in donemler)
        {
            var donemKazanani = default(Guid);

            foreach (var kategori in kategoriler)
            {
                var sablonlar = KategoriFikirleri.TryGetValue(kategori.Name, out var s)
                    ? s
                    : ["Bu kategoride okulumuz için bir fikir üretelim."];

                // Kategori başına bir fikir bu dönemin bakanlık adayı olur.
                for (var k = 0; k < DonemBasinaKategoriFikri; k++)
                {
                    var ogrenci = ogrenciler[ogrenciSira++ % ogrenciler.Count];
                    var profil = await db.StudentProfiles.FirstAsync(p => p.ApplicationUserId == ogrenci.Id, cancellationToken);
                    var ilId = profil.ProvinceId;

                    // SubmittedAt, dönem aralığının İÇİNDE olmalı (aday havuzu sorgusu bunu şart koşuyor).
                    var gonderimZamani = donem.StartAt.AddDays(15 + k * 7)
                        .AddHours(new Random(k * 31 + kategori.Id).Next(1, 10));

                    var fikir = Idea.CreateDraft(
                        Guid.Parse(ogrenci.Id), ilId, kategori.Id,
                        sablonlar[k % sablonlar.Length], gonderimZamani.AddDays(-2));

                    // --- Durum zinciri: domain metotlarıyla ---
                    fikir.Submit(ilId, gonderimZamani);
                    fikir.MoveToInEvaluation(gonderimZamani.AddDays(3));
                    fikir.CompleteEvaluation(gonderimZamani.AddDays(4));
                    fikir.Approve(gonderimZamani.AddDays(5));

                    // Değerlendirme kayıtları (4 kriter × 2 değerlendirici).
                    var degerlendiriciListesi = degerlendiriciler.TryGetValue(ilId, out var dl) ? dl : [];
                    for (var d = 0; d < degerlendiriciListesi.Count && d < DegerlendiriciSayisi; d++)
                    {
                        foreach (var kriter in Enum.GetValues<EvaluationCriterion>())
                        {
                            var kriterNo = (int)kriter;
                            db.Evaluations.Add(new Evaluation
                            {
                                IdeaId = fikir.Id,
                                EvaluatorUserId = degerlendiriciListesi[d].Id,
                                Criterion = kriter,
                                // 3–5 arası: eşiğin (3.5) üstünde ortalama.
                                Score = 3 + ((kategori.Id + kriterNo + d) % 3),
                                Comment = OkulYorumlari[(kategori.Id + kriterNo) % OkulYorumlari.Length],
                                EvaluatedAt = gonderimZamani.AddDays(3 + d),
                            });
                        }
                    }

                    db.Ideas.Add(fikir);
                    fikirSayisi++;

                    // Sadece ilk fikir (k==0) bu dönemin kategori adayı olur → Locked → Planned.
                    if (k == 0)
                    {
                        fikir.Plan(gonderimZamani.AddDays(7));
                        db.PeriodSelections.Add(new PeriodSelection
                        {
                            PeriodId = donem.Id,
                            CategoryId = kategori.Id,
                            IdeaId = fikir.Id,
                            SelectedByUserId = bakanlik.Id,
                            SelectedAt = donem.StartAt.AddDays(60),
                        });
                        adaySayisi++;

                        // Dönem kazananı: kategoriler arasında ilk 3'ünden biri.
                        if (donemKazanani == Guid.Empty && kategori.Id <= 3)
                        {
                            donemKazanani = fikir.Id;
                        }
                    }
                }
            }

            if (donemKazanani != Guid.Empty)
            {
                db.PeriodWinners.Add(new PeriodWinner
                {
                    PeriodId = donem.Id,
                    IdeaId = donemKazanani,
                    SelectedByUserId = bakanlik.Id,
                    SelectedAt = donem.StartAt.AddDays(75),
                });
            }
        }

        adim = "veritabanına kaydetme";
        await db.SaveChangesAsync(cancellationToken);

        return new
        {
            calistirildi = true,
            ogrenci = ogrenciler.Count,
            degerlendirici = degerlendiriciler.Values.Sum(l => l.Count),
            fikir = fikirSayisi,
            bakanlikAdayi = adaySayisi,
            donem = donemler.Count,
            kazanan = await db.PeriodWinners.CountAsync(cancellationToken),
            // Şifre YALNIZCA burada, bir kez görünür. Koda gömülmez.
            demoSifre = sifre,
            ornekGiris = $"{KullaniciOneki}ogrenci01@demo.local",
            not = "Bu hesaplar DEMO verisidir. Yayına almadan önce temizlenmelidir.",
        };
        }
    }

    /// <summary>
    /// Demo üretimi sırasında hangi adımda hata olduğunu taşır.
    /// Mesaj/veri içermez — yalnızca adım etiketi ve iç istisna.
    /// </summary>
    public sealed class DemoSeedAdimException(string adim, Exception icHata)
        : Exception($"[DEMO] Adım '{adim}' başarısız: {icHata.GetType().Name}", icHata)
    {
        public string Adim { get; } = adim;
    }

    private static async Task<ApplicationUser> KullaniciOlustur(
        UserManager<ApplicationUser> um, string email, string sifre, string adSoyad)
    {
        var parcalar = adSoyad.Split(' ', 2);
        var kullanici = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FirstName = parcalar[0],
            LastName = parcalar.Length > 1 ? parcalar[1] : "-",
            EmailConfirmed = true,
        };
        var sonuc = await um.CreateAsync(kullanici, sifre);
        if (!sonuc.Succeeded)
        {
            throw new InvalidOperationException(
                $"{email} oluşturulamadı: {string.Join(", ", sonuc.Errors.Select(e => e.Description))}");
        }
        await um.AddToRoleAsync(kullanici, "Student");
        return kullanici;
    }

    /// <summary>Demo verisini siler (puan, seçim, kazanan, fikir, profil, kullanıcı sırasıyla).</summary>
    private static async Task DemoVeriTemizle(
        FikirPlatformuDbContext db,
        UserManager<ApplicationUser> um,
        CancellationToken cancellationToken)
    {
        var demoKullanicilar = await db.Users.Where(u => (u.Email ?? "").StartsWith(KullaniciOneki)).ToListAsync(cancellationToken);
        if (demoKullanicilar.Count == 0) return;
        var ids = demoKullanicilar.Select(u => u.Id).ToList();
        var ogrenciler = demoKullanicilar
            .Where(u => (u.Email ?? "").StartsWith(KullaniciOneki + "ogrenci") && Guid.TryParse(u.Id, out _))
            .Select(u => Guid.Parse(u.Id)).ToList();

        if (ogrenciler.Count > 0)
        {
            var fikirler = await db.Ideas.Where(f => ogrenciler.Contains(f.StudentId)).ToListAsync(cancellationToken);
            var fikirIds = fikirler.Select(f => f.Id).ToList();

            await db.Evaluations.Where(e => fikirIds.Contains(e.IdeaId)).ExecuteDeleteAsync(cancellationToken);
            await db.PeriodSelections.Where(s => fikirIds.Contains(s.IdeaId)).ExecuteDeleteAsync(cancellationToken);
            await db.PeriodWinners.Where(w => fikirIds.Contains(w.IdeaId)).ExecuteDeleteAsync(cancellationToken);
            await db.Ideas.Where(f => fikirIds.Contains(f.Id)).ExecuteDeleteAsync(cancellationToken);
        }

        await db.StudentProfiles.Where(p => ids.Contains(p.ApplicationUserId)).ExecuteDeleteAsync(cancellationToken);
        await db.ProvinceUserAssignments.Where(a => ids.Contains(a.UserId)).ExecuteDeleteAsync(cancellationToken);

        foreach (var kullanici in demoKullanicilar)
        {
            await um.DeleteAsync(kullanici);
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>YEĞİTEK madde 16 (5 sınıf) parola kurallarını karşılayan rastgele parola.</summary>
    private static string RastgeleSifreUret()
    {
        const string buyuk = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string kucuk = "abcdefghijkmnpqrstuvwxyz";
        const string rakam = "23456789";
        const string sembol = "!#@$%&*?";
        var rnd = Random.Shared;
        var karakterler = new List<char>();
        karakterler.Add(buyuk[rnd.Next(buyuk.Length)]);
        karakterler.Add(kucuk[rnd.Next(kucuk.Length)]);
        karakterler.Add(rakam[rnd.Next(rakam.Length)]);
        karakterler.Add(sembol[rnd.Next(sembol.Length)]);

        const string havuz = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!#@$%&*?";
        for (var i = 0; i < 12; i++) karakterler.Add(havuz[rnd.Next(havuz.Length)]);

        // Fisher-Yates
        for (var i = karakterler.Count - 1; i > 0; i--)
        {
            var j = rnd.Next(i + 1);
            (karakterler[i], karakterler[j]) = (karakterler[j], karakterler[i]);
        }
        return new string(karakterler.ToArray());
    }
}