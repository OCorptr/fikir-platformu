using FikirPlatformu.Api.Bakim;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Bakım uçları — demo/test verisi üretimi.
///
/// Sprint 11.92. Güvenlik: <c>AdminMaintenance__Secret</c> tanımlı değilse
/// endpoint fail-closed (403) kalır — tıpkı <c>/api/__maintenance/admin-reset</c>.
///
/// Kullanım:
///   curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/demo-seed?token=SECRET"
///   curl -X POST "https://fikir-platformu.onrender.com/api/__maintenance/demo-seed?token=SECRET&amp;temizle=true"
/// </summary>
public static class BakimDemoEndpoints
{
    public static IEndpointRouteBuilder MapBakimDemoEndpoints(this IEndpointRouteBuilder app)
    {
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

            try
            {
                log.LogWarning("[DEMO] Demo veri üretimi başlatıldı (temizle={Temizle}).", temizle);
                var sonuc = await DemoVeriServisi.Uret(servisler, temizle, cancellationToken);
                log.LogWarning("[DEMO] Demo veri üretimi bitti.");
                return Results.Ok(sonuc);
            }
            catch (DemoVeriServisi.DemoSeedAdimException ex)
            {
                // Adım + iç hata tipi: teşhis için yeterli, veri/şifre sızdırmaz.
                log.LogError(ex.InnerException, "[DEMO] Hata — adım={Adim}", ex.Adim);
                return Results.Json(new
                {
                    calistirildi = false,
                    hataAdimi = ex.Adim,
                    hataTipi = ex.InnerException?.GetType().Name,
                    message = "Demo veri üretilemedi. Ayrıntı için sunucu loglarına bakın.",
                }, statusCode: 500);
            }
            catch (Exception ex)
            {
                // İstisna metni istemciye SIZMAZ (YEĞİTEK madde 41) — sadece log.
                log.LogError(ex, "[DEMO] Demo veri üretimi başarısız.");
                return Results.Json(
                    new { message = "Demo veri üretilemedi. Ayrıntı için sunucu loglarına bakın." },
                    statusCode: 500);
            }
        });

        return app;
    }
}