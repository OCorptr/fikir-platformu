namespace FikirPlatformu.Api;

/// <summary>
/// Kurulum sonrası ilk hesapları oluşturan komut satırı aracı (Sprint 11.52).
///
/// NEDEN YENİDEN YAZILDI:
///   Eski `seed/ilk_hesaplar.py` (a) canlı veritabanı kimlik bilgilerini varsayılan
///   değer olarak içeriyordu, (b) geliştiricinin production DB'sindeki tek bir
///   referans satıra bağımlıydı (temiz kurulumda hata verip çıkıyordu), (c) Python'da
///   Identity V3 uyumlu hash üretemiyordu. Hiçbir Python bağımlılığı gerekmesin diye
///   C# UserManager üzerinden çalışır — hash algoritması Identity ile birebir aynıdır.
///
/// KULLANIM (backend dizininde):
///   dotnet run --project src/FikirPlatformu.Api -- seed
///
/// GEREKLİ ORTAM DEĞİŞKENLERİ:
///   ConnectionStrings__MySql     — hedef veritabanı
///   SEED_ADMIN_PASSWORD         — sistem yöneticisi şifresi (zorunlu)
///   SEED_ADMIN_EMAIL            — sistem yöneticisi e-postası (varsayılan sistem.admin@kurum.local)
///   SEED_SIFRE                  — diğer seed hesaplarının ortak şifresi (varsayılan: SEED_ADMIN_PASSWORD)
///
/// YAN ETKİ: Hedef veritabanı boş değilse, hiçbir şey yazılmadan çıkar (fail-closed).
/// Böylece yanlışlıkla üretim veritabanına seed yazılamaz.
/// </summary>
internal static class KurulumSeedAraci
{
    public const string VarsayilanAdminEmail = "sistem.admin@kurum.local";
    public const string VarsayilanSifre = "KurulumSifresi2026!";

    /// <summary>
    /// seed komutu çalıştırılmalı mı? Yalnızca `seed` argümanı verilmişse true.
    /// </summary>
    public static bool CalistirilacakMi(string[] args)
        => args.Any(a => a.Trim().Equals("seed", StringComparison.OrdinalIgnoreCase));

    public static async Task CalistirAsync(IServiceProvider servisler, IConfiguration yapilandirma, ILogger logger)
    {
        var kapsam = servisler.CreateScope();
        var sağlayici = kapsam.ServiceProvider;

        var db = sağlayici.GetRequiredService<Infrastructure.Persistence.FikirPlatformuDbContext>();
        var kullaniciYoneticisi = sağlayici.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<Infrastructure.Identity.ApplicationUser>>();
        var rolYoneticisi = sağlayici.GetRequiredService<Microsoft.AspNetCore.Identity.RoleManager<Microsoft.AspNetCore.Identity.IdentityRole>>();

        // 1) Güvenlik: hedef DB boş değilse dokunma.
        // Not: DbSet zaten IQueryable; burada senkron Count yeterli (tek seferlik komut).
        var mevcutKullanici = db.Users.Count();
        if (mevcutKullanici > 0)
        {
            logger.LogError(
                "[SEED] HEDEF VERİTABANINDA {Sayi} KULLANICI VAR — seed iptal edildi. " +
                "Yanlış veritabanına yazmamak için hiçbir değişiklik yapılmadı.",
                mevcutKullanici);
            logger.LogError("[SEED] Temiz kurulum gerekiyorsa boş bir veritabanı kullanın.");
            return;
        }

        // 2) Şifre kaynağı.
        var adminSifre = Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD")
            ?? yapilandirma["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(adminSifre))
        {
            logger.LogError(
                "[SEED] SEED_ADMIN_PASSWORD tanımlı değil — seed iptal edildi. " +
                "Örnek: set SEED_ADMIN_PASSWORD=<guclu-sifre>");
            return;
        }

        var adminEmail = Environment.GetEnvironmentVariable("SEED_ADMIN_EMAIL")
            ?? yapilandirma["Seed:AdminEmail"]
            ?? VarsayilanAdminEmail;
        var digerSifre = Environment.GetEnvironmentVariable("SEED_SIFRE") ?? adminSifre;

        // Sprint 11.53: Şifre kuralları sıkılaştı (rakam + özel karakter zorunlu).
        // Kullanıcı kurala uymayan bir şifre verirse Identity'nin İngilizce hatası
        // yerine net bir Türkçe mesaj gösteriyoruz.
        var ihlaller = new List<string>();
        if (adminSifre.Length < 8) ihlaller.Add("en az 8 karakter");
        if (!adminSifre.Any(char.IsUpper)) ihlaller.Add("en az bir büyük harf");
        if (!adminSifre.Any(char.IsLower)) ihlaller.Add("en az bir küçük harf");
        if (!adminSifre.Any(char.IsDigit)) ihlaller.Add("en az bir rakam");
        if (!adminSifre.Any(c => !char.IsLetterOrDigit(c))) ihlaller.Add("en az bir özel karakter (örn. ! ? @ # $)");

        if (ihlaller.Count > 0)
        {
            logger.LogError("[SEED] SEED_ADMIN_PASSWORD kurallara uymuyor: {Ihlaller}", string.Join(", ", ihlaller));
            logger.LogError("[SEED] Örnek uyumlu şifre: F1kir-YEG1TEK-2026-aX9kLm2");
            return;
        }

        // 3) Roller.
        string[] roller = ["Student", "ProvinceEvaluator", "ProvinceManager", "MinistryOfficial", "SystemAdmin"];
        foreach (var rol in roller)
        {
            if (!await rolYoneticisi.RoleExistsAsync(rol))
            {
                await rolYoneticisi.CreateAsync(new Microsoft.AspNetCore.Identity.IdentityRole(rol));
            }
        }

        // 4) Hesaplar (Sprint 11 öncesi dokümanlarda listelenen 9 hesap).
        var hesaplar = new (string Rol, string Email, string Ad, string Soyad, string Sifre)[]
        {
            ("SystemAdmin",        adminEmail,                              "Sistem", "Yöneticisi",   adminSifre),
            ("MinistryOfficial",   "bakanlik@kurum.local",                  "Bakanlık", "Yetkilisi",   digerSifre),
            ("ProvinceManager",    "il.istanbul@kurum.local",               "İstanbul", "İl Yöneticisi", digerSifre),
            ("ProvinceManager",    "il.ankara@kurum.local",                 "Ankara",   "İl Yöneticisi", digerSifre),
            ("ProvinceManager",    "il.izmir@kurum.local",                  "İzmir",    "İl Yöneticisi", digerSifre),
            ("ProvinceEvaluator",  "deg.istanbul@kurum.local",              "İstanbul", "Değerlendirici", digerSifre),
            ("ProvinceEvaluator",  "deg.ankara@kurum.local",                "Ankara",   "Değerlendirici", digerSifre),
            ("ProvinceEvaluator",  "deg.izmir@kurum.local",                 "İzmir",    "Değerlendirici", digerSifre),
            ("Student",            "demo.ogrenci@kurum.local",              "Demo",     "Öğrenci",      digerSifre),
        };

        var olusturulan = 0;
        foreach (var h in hesaplar)
        {
            var kullanici = new Infrastructure.Identity.ApplicationUser
            {
                UserName = h.Email,
                Email = h.Email,
                FirstName = h.Ad,
                LastName = h.Soyad,
                EmailConfirmed = true,
            };

            var sonuc = await kullaniciYoneticisi.CreateAsync(kullanici, h.Sifre);
            if (!sonuc.Succeeded)
            {
                var hatalar = FikirPlatformu.Api.Endpoints.SifreKuraliMesaji.Turkce(sonuc);
                logger.LogError("[SEED] {Email} oluşturulamadı: {Hatalar}", h.Email, hatalar);
                continue;
            }

            await kullaniciYoneticisi.AddToRoleAsync(kullanici, h.Rol);
            olusturulan++;
            logger.LogInformation("[SEED] Oluşturuldu: {Rol} → {Email}", h.Rol, h.Email);
        }

        logger.LogInformation(
            "[SEED] TAMAMLANDI — {Sayi} hesap oluşturuldu. " +
            "Rapor edilen şifreleri DEĞİŞTİRİN ve MFA kurun.",
            olusturulan);
    }
}
