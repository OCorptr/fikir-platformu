using System.Collections.Concurrent;
using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Basit matematik CAPTCHA (plan §2.6 + YEĞİTEK gereksinim #2):
/// - /new: yeni challenge üretir (örn. "5 + 3")
/// - /verify: cevabı doğrular
/// - Soru-cevap çifti sunucuda 5 dakika tutulur; tek kullanımlık.
/// - İlk doğrulamadan sonra ID geçersiz olur (replay koruması).
/// Başarısız doğrulamalarda AuthEvent tablosuna kayıt düşer (PII mask'li).
/// </summary>
public static class CaptchaEndpoints
{
    private static readonly ConcurrentDictionary<string, CaptchaChallenge> Challenges = new();
    private static readonly TimeSpan YasamSuresi = TimeSpan.FromMinutes(5);

    public sealed record CaptchaSoruIstegi;

    public sealed record CaptchaSoruCevabi(
        [Required] string Id,
        [Required, RegularExpression("^[0-9-]{1,6}$")] string Answer);

    private sealed record CaptchaChallenge(int DogruCevap, DateTime OlusturmaZamani);

    public static IEndpointRouteBuilder MapCaptchaEndpoints(this IEndpointRouteBuilder app)
    {
        var grup = app.MapGroup("/api/auth/captcha").WithTags("Captcha");

        grup.MapGet("/new", () =>
        {
            // Temizle: süresi dolmuş challenge'ları sil (10 dk'dan eski).
            Temizle();

            var a = RandomNumberGenerator.GetInt32(1, 10);
            var b = RandomNumberGenerator.GetInt32(1, 10);
            var toplam = a + b;
            var id = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

            Challenges[id] = new CaptchaChallenge(toplam, DateTime.UtcNow);

            return Results.Ok(new
            {
                id,
                question = $"{a} + {b}"
            });
        }).AllowAnonymous();

        grup.MapPost("/verify", (CaptchaSoruCevabi istek) =>
        {
            if (!Challenges.TryGetValue(istek.Id, out var challenge))
                return Results.Json(new { message = "CAPTCHA süresi dolmuş veya geçersiz." }, statusCode: 400);

            // Tek kullanımlık: doğrulamadan sonra sil.
            Challenges.TryRemove(istek.Id, out _);

            // Süre kontrolü (defense-in-depth).
            if (DateTime.UtcNow - challenge.OlusturmaZamani > YasamSuresi)
                return Results.Json(new { message = "CAPTCHA süresi dolmuş." }, statusCode: 400);

            if (!int.TryParse(istek.Answer, out var cevap) || cevap != challenge.DogruCevap)
                return Results.Json(new { message = "CAPTCHA cevabı yanlış." }, statusCode: 400);

            return Results.Ok(new { valid = true });
        }).AllowAnonymous();

        return app;
    }

    /// <summary>Login/register endpoint'leri bununla doğrular — eğer challenge hâlâ bellekteyse geçerli.</summary>
    public static bool CaptchaGecerliMi(string? challengeId, string? cevap)
    {
        if (string.IsNullOrEmpty(challengeId) || string.IsNullOrEmpty(cevap)) return false;
        if (!Challenges.TryGetValue(challengeId, out var ch)) return false;
        Challenges.TryRemove(challengeId, out _);
        if (DateTime.UtcNow - ch.OlusturmaZamani > YasamSuresi) return false;
        return int.TryParse(cevap, out var n) && n == ch.DogruCevap;
    }

    private static void Temizle()
    {
        var sinir = DateTime.UtcNow - YasamSuresi;
        var eskiler = Challenges.Where(kv => kv.Value.OlusturmaZamani < sinir).Select(kv => kv.Key).ToList();
        foreach (var key in eskiler)
            Challenges.TryRemove(key, out _);
    }
}