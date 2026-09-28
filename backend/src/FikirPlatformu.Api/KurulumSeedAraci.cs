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
    /// <summary>
    /// SEED_ADMIN_EMAIL verilmemişse kullanılır. Kurum e-posta adresi
    /// bilinmediği için genel bir yer tutucu — teslim paketinde .env içindeki
    /// SEED_ADMIN_EMAIL her zaman bu değeri ezer.
    /// </summary>
    public const string VarsayilanAdminEmail = "sistem.yoneticisi@kurum.local";

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
        // Sprint 11.54: seed artık YALNIZCA sistem yöneticisi oluşturur.
        // Diğer roller kurulumdan sonra Admin Panel'den açılır.

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
            return;
        }

        // 3) Roller. Hesaplar uygulama içinden açılabilsin diye tüm roller hazırlanır.
        string[] roller = ["Student", "ProvinceEvaluator", "ProvinceManager", "MinistryOfficial", "SystemAdmin"];
        foreach (var rol in roller)
        {
            if (!await rolYoneticisi.RoleExistsAsync(rol))
            {
                await rolYoneticisi.CreateAsync(new Microsoft.AspNetCore.Identity.IdentityRole(rol));
            }
        }

        // 4) Yalnızca sistem yöneticisi oluşturulur.
        //
        //    Neden diğer roller için örnek hesaplar yok: teslim edilen kurulumda
        //    uydurma e-posta adresleri (ornegin bakanlik@kurum.local) yanlış
        //    varsayımlara yol açabilir ve aynı parolayı taşıyan fazla hesaplar
        //    güvenlik riski oluşturur. Diğer hesaplar kurulumdan sonra
        //    **Admin Panel > Kullanıcı Yönetimi** ekranından açılır.
        var sistemAdmin = new Infrastructure.Identity.ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            FirstName = "Sistem",
            LastName = "Yöneticisi",
            EmailConfirmed = true,
        };

        var olusturma = await kullaniciYoneticisi.CreateAsync(sistemAdmin, adminSifre);
        if (!olusturma.Succeeded)
        {
            logger.LogError("[SEED] Sistem yöneticisi oluşturulamadı: {Hatalar}",
                FikirPlatformu.Api.Endpoints.SifreKuraliMesaji.Turkce(olusturma));
            return;
        }

        await kullaniciYoneticisi.AddToRoleAsync(sistemAdmin, "SystemAdmin");
        await kullaniciYoneticisi.AddToRoleAsync(sistemAdmin, "MinistryOfficial");

        logger.LogInformation(
            "[SEED] TAMAMLANDI — Sistem yöneticisi oluşturuldu: {Email}", adminEmail);
        logger.LogInformation(
            "[SEED] Diğer hesapları **Admin Panel > Kullanıcı Yönetimi** ekranından açın. " +
            "MFA kurulumu ilk girişten sonra zorunludur.");
    }
}
