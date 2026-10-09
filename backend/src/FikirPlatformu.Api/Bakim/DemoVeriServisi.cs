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

        // Hata olursa hangi ADIM'da olduğumuzu bilelim. NOT: `string` değeri
        // metot çağrısında KOPIALANIR; atama içeride dış değişkeni güncellemez.
        // Bu yüzden referans tipi bir kutu (AdimKutusu) kullanıyoruz.
        var adim = new AdimKutusu("başlatma");
        try
        {
            return await UretIc(adim);
        }
        catch (Exception ex)
        {
            throw new DemoSeedAdimException(adim.Deger, ex);
        }

        async Task<object> UretIc(AdimKutusu adim)
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
            adim.Deger = "demo verilerini temizleme";
            await DemoVeriTemizle(db, um, cancellationToken);
        }

        adim.Deger = "rolleri oluşturma";
        // ---- Roller (yoksa oluştur) + kimliklerini topla ----
        // Identity 9'da kullanıcı→rol bağı RoleId ile kurulur (RoleName değil).
        var rolIds = new Dictionary<string, string>();
        foreach (var rolAdi in new[] { "Student", "ProvinceEvaluator", "ProvinceManager", "MinistryOfficial", "SystemAdmin" })
        {
            var rol = await rm.FindByNameAsync(rolAdi);
            if (rol is null)
            {
                await rm.CreateAsync(new IdentityRole(rolAdi));
                rol = await rm.FindByNameAsync(rolAdi);
            }
            if (rol is not null) rolIds[rolAdi] = rol.Id;
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

        // Sprint 11.92: Render'ın istek zaman aşımı (100 sn) seed'i kesiyordu —
        // 263 kullanıcıyı UserManager.CreateAsync ile tek tek oluşturmak
        // (her biri PBKDF2 + uzak DB turu) dakikalar sürüyordu.
        // Çözüm: parola hash'ini BİR kez hesapla, hepsinde paylaş; kullanıcı ve
        // roller toplu eklensin. 263 PBKDF2 → 1, 500+ INSERT → 2.
        var parolaHash = HashParola(sifre);
        var roller = new List<IdentityUserRole<string>>();
        var yeniKullanicilar = new List<ApplicationUser>();

        ApplicationUser KullaniciEkle(string email, string adSoyad, string rol)
        {
            var parcalar = adSoyad.Split(' ', 2);
            var kullanici = new ApplicationUser
            {
                Id = Guid.NewGuid().ToString(),
                UserName = email,
                Email = email,
                FirstName = parcalar[0],
                LastName = parcalar.Length > 1 ? parcalar[1] : "-",
                EmailConfirmed = true,
                PasswordHash = parolaHash,
                SecurityStamp = Guid.NewGuid().ToString(),
                LockoutEnabled = true,
            };
            yeniKullanicilar.Add(kullanici);
            roller.Add(new IdentityUserRole<string> { UserId = kullanici.Id, RoleId = rolIds[rol] });
            return kullanici;
        }

        adim.Deger = "öğrenci hesaplarını oluşturma";
        // ---- Öğrenciler ----
        // ⚠️ `ideas.student_id` FK'sı `student_profiles.id` referansı verir,
        // ApplicationUser.Id'ye DEĞİL. Profil id'leri burada tutup fikir
        // üretirken doğrudan kullanıyoruz (ayrıca her fikir için DB'ye gitmiyoruz).
        var ogrenciler = new List<(Guid ProfilId, int IlId)>();
        var kullanilanIlIds = new List<int>();
        for (var i = 0; i < OgrenciSayisi; i++)
        {
            var il = iller[i % iller.Count];
            if (!kullanilanIlIds.Contains(il.Id)) kullanilanIlIds.Add(il.Id);

            var ogrenci = KullaniciEkle(
                $"{KullaniciOneki}ogrenci{i + 1:00}@demo.local",
                $"{Adlar[i % Adlar.Length]} {Soyadlar[(i * 7) % Soyadlar.Length]}",
                "Student");

            var profilId = Guid.NewGuid();
            db.StudentProfiles.Add(new StudentProfile
            {
                Id = profilId,
                ApplicationUserId = ogrenci.Id,
                ProvinceId = il.Id,
                School = Okullar[i % Okullar.Length],
                Grade = 7 + (i % 6),
                StudentNumber = $"2026{(i + 1):0000}",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
            ogrenciler.Add((profilId, il.Id));
        }

        adim.Deger = "değerlendirici ve il yöneticisi hesaplarını oluşturma";
        // ---- Değerlendiriciler: YALNIZCA fikir yazan öğrencilerin illeri için.
        // (Önceden 81 il × 3 kişi = 243 hesap üretiliyordu; büyük kısmı kullanılmıyordu.)
        var degerlendiriciler = new Dictionary<int, List<ApplicationUser>>();
        var sira = 0;
        foreach (var ilId in kullanilanIlIds)
        {
            var liste = new List<ApplicationUser>();
            for (var r = 1; r <= DegerlendiriciSayisi; r++)
            {
                liste.Add(KullaniciEkle(
                    $"{KullaniciOneki}degerlendirici{ilId:000}-{r}@demo.local",
                    $"Değerlendirici {++sira:000}-{r}", "ProvinceEvaluator"));
            }
            var yonetici = KullaniciEkle(
                $"{KullaniciOneki}yonetici{ilId:000}@demo.local",
                $"İl Yöneticisi {ilId:000}", "ProvinceManager");
            db.ProvinceUserAssignments.Add(ProvinceUserAssignment.Create(
                yonetici.Id, ilId, "ProvinceManager", "demo-seed", DateTimeOffset.UtcNow));
            degerlendiriciler[ilId] = liste;
        }

        // ---- Bakanlık yetkilisi (kazanan seçimi denetim kaydı için) ----
        var bakanlik = KullaniciEkle($"{KullaniciOneki}bakanlik@demo.local", "Bakanlık Temsilcisi", "MinistryOfficial");

        adim.Deger = "kullanıcıları tek seferde yazma";
        db.Users.AddRange(yeniKullanicilar);
        db.UserRoles.AddRange(roller);
        await db.SaveChangesAsync(cancellationToken);

        adim.Deger = "fikir, değerlendirme ve kazanan üretme";
        // ---- Fikirler: her dönem × her kategori ----
        var fikirSayisi = 0;
        var adaySayisi = 0;
        var ogrenciSira = 0;

        var donemSira = 0;
        foreach (var donem in donemler)
        {
            var donemKazanani = default(Guid);

            // Her dönemin kazananı FARKLI kategoriden ve FARKLI öğrenciden olsun.
            // Sabit bir kategori seçimi dört dönemin kazananını da aynı yapıyordu
            // (hep "Kültür ve Sanat" / aynı öğrenci) — gerçekçi değil.
            var kazananKategoriId = kategoriler[donemSira % kategoriler.Count].Id;
            ogrenciSira = donemSira * 7;

            foreach (var kategori in kategoriler)
            {
                var sablonlar = KategoriFikirleri.TryGetValue(kategori.Name, out var s)
                    ? s
                    : ["Bu kategoride okulumuz için bir fikir üretelim."];

                // Kategori başına bir fikir bu dönemin bakanlık adayı olur.
                for (var k = 0; k < DonemBasinaKategoriFikri; k++)
                {
                    var ogrenci = ogrenciler[ogrenciSira++ % ogrenciler.Count];
                    var ilId = ogrenci.IlId;

                    // SubmittedAt, dönem aralığının İÇİNDE olmalı (aday havuzu sorgusu bunu şart koşuyor).
                    var gonderimZamani = donem.StartAt.AddDays(15 + k * 7)
                        .AddHours(new Random(k * 31 + kategori.Id).Next(1, 10));

                    var fikir = Idea.CreateDraft(
                        ogrenci.ProfilId, ilId, kategori.Id,
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

                        // Dönem kazananı: bu dönem için ayrılmış kategoriden biri.
                        if (donemKazanani == Guid.Empty && kategori.Id == kazananKategoriId)
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

            donemSira++;
        }

        adim.Deger = "veritabanına kaydetme";
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
    /// Adım etiketini taşır. Referans tipi olmasının sebebi: `string` değişkeni
    /// metot çağrısında kopyalanır, içeride atama yapılınca dışarıdaki güncellenmez —
    /// bu yüzden hata "başlatma" adımında görünüyordu.
    /// </summary>
    private sealed class AdimKutusu(string baslangic)
    {
        public string Deger { get; set; } = baslangic;
    }

    /// <summary>
    /// Demo üretimi sırasında hangi adımda hata olduğunu taşır.
    /// </summary>
    public sealed class DemoSeedAdimException(string adim, Exception icHata)
        : Exception($"[DEMO] Adım '{adim}' başarısız: {icHata.GetType().Name}", icHata)
    {
        public string Adim { get; } = adim;
    }

    /// <summary>
    /// Demo parolasının hash'ini BİR kez hesaplar; tüm demo hesapları aynı
    /// hash'i paylaşır. (PBKDF2'yi kullanıcı başına çalıştırmak seed'i dakikalara
    /// uzatıyordu ve Render'ın 100 sn istek zaman aşımına takılıyordu.)
    /// </summary>
    private static string HashParola(string sifre)
    {
        var hasher = new PasswordHasher<ApplicationUser>();
        return hasher.HashPassword(new ApplicationUser(), sifre);
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
        // ⚠️ `ideas.student_id` → `student_profiles.id` FK'sı var; fikirler
        // profil id'siyle tutulur, kullanıcı id'siyle DEĞİL.
        var profilIds = await db.StudentProfiles
            .Where(p => ids.Contains(p.ApplicationUserId))
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);

        if (profilIds.Count > 0)
        {
            var fikirler = await db.Ideas.Where(f => profilIds.Contains(f.StudentId)).ToListAsync(cancellationToken);
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
