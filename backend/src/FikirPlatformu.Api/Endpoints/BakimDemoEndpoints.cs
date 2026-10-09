using FikirPlatformu.Api.Bakim;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Bakım uçları — demo/test verisi üretimi.
///
/// Sprint 11.92 GÜVENLİK (iki katman):
///   1. <c>BakimModu=Acik</c> tanımlı DEĞİLSE bu uçlar hiç map edilmez
///      (fail-closed). MEB'e taşırken tanımlanmamalıdır.
///   2. Anahtar artık <b>URL'de değil</b>, <c>X-Maintenance-Token</c> başlığındadır
///      (OWASP ASVS 8.3.1 — sorgu dizesine sır konmaz).
///
/// Kullanım (PowerShell):
///   $h = @{ 'X-Maintenance-Token' = $env:BAKIM }
///   Invoke-RestMethod -Method Post -Headers $h -Uri "…/api/__maintenance/demo-seed?mod=ogrenci"
/// </summary>
public static class BakimDemoEndpoints
{
    public static IEndpointRouteBuilder MapBakimDemoEndpoints(
        this IEndpointRouteBuilder app, IConfiguration yapilandirma)
    {
        // Katman 1: mod kapalıysa uçlar hiç var olmaz.
        if (!BakimGizliAnahtar.Acik(yapilandirma))
        {
            return app;
        }

        app.MapPost("/api/__maintenance/demo-seed", async (
            HttpContext http,
            IConfiguration yapilandirma,
            IServiceProvider servisler,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            var log = loggerFactory.CreateLogger("FikirPlatformu.DemoSeed");

            if (!BakimGizliAnahtar.Gecerli(http, yapilandirma))
            {
                return Results.Json(new { message = "Yetkisiz. Token yanlış veya eksik." }, statusCode: 403);
            }

            var temizle = http.Request.Query["temizle"].ToString() == "true";
            // Sprint 11.92: `sadeceTemizle` → yalnızca siler, yeniden üretmez.
            var sadeceTemizle = http.Request.Query["sadeceTemizle"].ToString() == "true";
            // Sprint 11.92: `mod=ogrenci` → yalnızca 10 öğrenci + fikirleri.
            // Değerlendirici/yönetici/bakanlık hesabı AÇILMAZ.
            var ogrenciModu = http.Request.Query["mod"].ToString() == "ogrenci";

            // Sprint 11.92: `mod=uzun` → sınırdaki (1500 karakter) tek fikir.
            var uzunModu = http.Request.Query["mod"].ToString() == "uzun";

            // Sprint 11.92: `mod=personel` → yalnızca yönetim hesapları.
            var personelModu = http.Request.Query["mod"].ToString() == "personel";

            // Sprint 11.92: `mod=sifre` → mevcut demo hesaplarının parolasını düzeltir
            // (hesapları silmez, fikirleri/seçimleri korur).
            var sifreModu = http.Request.Query["mod"].ToString() == "sifre";

            // Sprint 11.92: `mod=inboxtest` → inbox sorgusunu doğrudan çalıştırıp
            // hatayı döner (teşhis). Uç gizli anahtarla korumalı, bu yüzden iç
            // hata metnini yanıta koymak güvenlidir.
            var inboxTestModu = http.Request.Query["mod"].ToString() == "inboxtest";

            // Sprint 11.92: `mod=inboxtest` → inbox sorgusunu doğrudan çalıştırıp
            // hatayı döner (teşhis). Uç gizli anahtarla korumalı, bu yüzden iç
            // hata metnini yanıta koymak güvenlidir. Kendi try/catch'inde —
            // aşağıdaki genel catch mesajı yutmasın.
            if (http.Request.Query["mod"].ToString() == "inboxtest")
            {
                try
                {
                    var asama = http.Request.Query["asama"].ToString() == "kararli"
                        ? FikirPlatformu.Application.Provinces.InboxAsama.Kararli
                        : FikirPlatformu.Application.Provinces.InboxAsama.Gelen;
                    using var scope = servisler.CreateScope();
                    var svc = scope.ServiceProvider
                        .GetRequiredService<FikirPlatformu.Application.Provinces.IProvinceInboxQueryService>();
                    var liste = await svc.ListAsync(null, "teşhis", asama, cancellationToken);
                    return Results.Ok(new { basarili = true, adet = liste.Count });
                }
                catch (Exception ex)
                {
                    var kok = ex;
                    while (kok.InnerException is not null) kok = kok.InnerException;
                    return Results.Json(new
                    {
                        basarili = false,
                        hataTipi = ex.GetType().Name,
                        mesaj = ex.Message,
                        kokMesaj = kok.Message,
                    }, statusCode: 500);
                }
            }

            // Sprint 11.92: `mod=gecmis` → aktif dönem dışındaki iki döneme
            // birer test kaydı (bakanlık kazananı dahil) ekler.
            if (http.Request.Query["mod"].ToString() == "gecmis")
            {
                try
                {
                    var g = await DemoVeriServisi.GecmisDonemKayitlari(servisler, cancellationToken);
                    return Results.Ok(g);
                }
                catch (Exception ex)
                {
                    var kok = ex;
                    while (kok.InnerException is not null) kok = kok.InnerException;
                    return Results.Json(new
                    {
                        calistirildi = false,
                        hataTipi = ex.GetType().Name,
                        mesaj = ex.Message,
                        kokMesaj = kok.Message,
                    }, statusCode: 500);
                }
            }

            // Sprint 11.92: `mod=demoriza` → demo öğrencilerine yayım iznı tamamlar
            // (yayım kapısı açılsın diye; gerçek öğrencilere dokunmaz).
            if (http.Request.Query["mod"].ToString() == "demoriza")
            {
                try
                {
                    var r = await DemoVeriServisi.DemoYayimRizasi(servisler, cancellationToken);
                    return Results.Ok(r);
                }
                catch (Exception ex)
                {
                    var kok = ex;
                    while (kok.InnerException is not null) kok = kok.InnerException;
                    return Results.Json(new
                    {
                        calistirildi = false,
                        hataTipi = ex.GetType().Name,
                        mesaj = ex.Message,
                        kokMesaj = kok.Message,
                    }, statusCode: 500);
                }
            }

            try
            {
                if (sifreModu)
                {
                    log.LogWarning("[DEMO] Demo şifreleri düzeltiliyor.");
                    var sf = await DemoVeriServisi.SifreleriDuzelt(servisler, cancellationToken);
                    return Results.Ok(sf);
                }

                if (personelModu)
                {
                    log.LogWarning("[DEMO] Personel modu başlatıldı.");
                    var p = await DemoVeriServisi.PersonelEkle(servisler, cancellationToken);
                    return Results.Ok(p);
                }

                if (uzunModu)
                {
                    log.LogWarning("[DEMO] Uzun fikir modu başlatıldı.");
                    var u = await DemoVeriServisi.UzunFikirEkle(servisler, cancellationToken);
                    return Results.Ok(u);
                }

                if (ogrenciModu)
                {
                    log.LogWarning("[DEMO] Öğrenci modu başlatıldı (oncekiVeriyiSil={Sil}).", sadeceTemizle);
                    var o = await DemoVeriServisi.OgrenciEkle(servisler, sadeceTemizle, cancellationToken);
                    return Results.Ok(o);
                }

                log.LogWarning("[DEMO] Demo işlemi başlatıldı (temizle={Temizle}, sadeceTemizle={Sadece}).",
                    temizle, sadeceTemizle);
                var sonuc = await DemoVeriServisi.Uret(servisler, temizle, sadeceTemizle, cancellationToken);
                log.LogWarning("[DEMO] Demo işlemi bitti.");
                return Results.Ok(sonuc);
            }
            catch (DemoVeriServisi.DemoSeedAdimException ex)
            {
                log.LogError(ex.InnerException, "[DEMO] Hata — adım={Adim}", ex.Adim);
                return Results.Json(new
                {
                    calistirildi = false,
                    hataAdimi = ex.Adim,
                    hataTipi = KokHata(ex)?.GetType().Name,
                    // Bu uc BAKIM ucu: `AdminMaintenance__Secret` olmadan 403 döner,
                    // yani yalnızca kurum yetkilisi görebilir. Teşhis için iç hata
                    // metni döner; bağlantı dizesi/parola kalıpları temizlenir.
                    hataMesaji = Temizle(KokHata(ex)?.Message),
                    message = "Demo veri üretilemedi.",
                }, statusCode: 500);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "[DEMO] Demo veri üretimi başarısız.");
                return Results.Json(
                    new { message = "Demo veri üretilemedi. Ayrıntı için sunucu loglarına bakın." },
                    statusCode: 500);
            }
        });

        return app;
    }

    /// <summary>En içteki istisna — asıl neden orada genellikle.</summary>
    private static Exception? KokHata(Exception? hata)
    {
        while (hata?.InnerException is not null) hata = hata.InnerException;
        return hata;
    }

    /// <summary>
    /// Bakım ucunun hata metninden bağlantı dizesi/parola kalıplarını siler.
    /// YEĞİTEK madde 41: gizli değer yanıtta görünmez.
    /// </summary>
    private static string? Temizle(string? mesaj)
    {
        if (string.IsNullOrWhiteSpace(mesaj)) return null;
        var s = mesaj;
        foreach (var desen in new[]
                 {
                     @"(?i)(password|pwd|user\s+id|server|host|port|database)\s*=\s*[^;\s]+",
                     @"(?i)Server=[^;]+;",
                 })
        {
            s = System.Text.RegularExpressions.Regex.Replace(s, desen, "[gizlendi]");
        }
        return s.Length <= 400 ? s : s[..400] + "…";
    }
}