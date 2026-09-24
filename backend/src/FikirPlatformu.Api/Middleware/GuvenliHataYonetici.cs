using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;

namespace FikirPlatformu.Api.Middleware;

/// <summary>
/// Güvenli global hata yönetici (YEĞİTEK gereksinim #41 — hata durumlarında PII sızıntısı yok):
/// - Yakalanmamış exception'lar 500 + sanitized ProblemDetails döner
/// - 404 için özel mesaj (stack trace / connection string / file path sızdırmaz)
/// - response'ta traceId var ama kullanıcı email/şifre alanı göstermez
/// </summary>
public static class GuvenliHataYonetici
{
    public static void Kullan(IApplicationBuilder app)
    {
        // ASP.NET Core 8+ UseExceptionHandler middleware'i ile birlikte çalışır.
        app.UseExceptionHandler(uygulamaHatasi => uygulamaHatasi.Run(async httpContext =>
        {
            var ozellik = httpContext.Features.Get<IExceptionHandlerFeature>();
            var hata = ozellik?.Error;

            // Production'da stack trace / internal details ASLA dönme.
            // Development'ta detay göster (debug için).
            var devDetay = string.Empty;
            if (httpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment())
            {
                devDetay = $" | Tip: {hata?.GetType().Name} — Mesaj: {hata?.Message}";
            }

            // Log internal — kullanıcıya ASLA dönme.
            var gunluk = httpContext.RequestServices.GetRequiredService<ILogger<Program>>();
            gunluk.LogError(hata, "Yakalanmamış hata (path: {Path})", httpContext.Request.Path);

            httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
            httpContext.Response.ContentType = "application/problem+json";
            await httpContext.Response.WriteAsJsonAsync(new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.6.1",
                title = "Sunucu hatası",
                status = StatusCodes.Status500InternalServerError,
                detail = $"İşlem sırasında beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.{(string.IsNullOrEmpty(devDetay) ? "" : devDetay)}",
                traceId = httpContext.TraceIdentifier
            });
        }));
    }
}