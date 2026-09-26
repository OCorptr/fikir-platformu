using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using FikirPlatformu.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FikirPlatformu.Infrastructure.Email;

/// <summary>
/// Gmail API (HTTPS port 443) üzerinden OAuth2 ile e-posta gönderir.
/// Render free tier SMTP portlarını blokladığı için gerekli.
///
/// Kurulum (Onur):
///   1) Google Cloud Console → proje oluştur → Gmail API enable et
///   2) OAuth consent screen: External, scope gmail.send
///   3) OAuth client: Web application, redirect_uri backend'in OAuth callback'i
///   4) /api/auth/gmail-oauth/start URL'ine git → Google login → consent ekranı
///   5) Gelen JSON'daki refresh_token'ı Render'a MAIL__GMAIL__REFRESHTOKEN olarak yapıştır
///   6) Sonraki tüm e-postalar onur35bilisim@gmail.com'dan gider
///
/// Avantajlar:
///   - SMTP port (25/465/587) bloklanmaz — HTTPS 443 garantili
///   - App Password gerekmez (Refresh token OAuth2 ile alınır)
///   - SPF/DKIM Gmail tarafında otomatik PASS (deliverability yüksek)
/// </summary>
public sealed class GmailApiEmailSender : IEmailSender
{
    public const string SaglayiciTipi = "gmail";

    public const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    public const string GmailSendEndpoint = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

    private readonly HttpClient _http;
    private readonly GmailAyarlari _ayarlar;
    private readonly ILogger<GmailApiEmailSender> _logger;

    // Access token cache (1 saat geçerli)
    private (string Token, DateTimeOffset Expiries)? _cachedToken;
    private readonly SemaphoreSlim _tokenLock = new(1, 1);

    public GmailApiEmailSender(HttpClient http, IOptions<GmailAyarlari> ayarlar, ILogger<GmailApiEmailSender> logger)
    {
        _http = http;
        _ayarlar = ayarlar.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var accessToken = await GetAccessTokenAsync(cancellationToken);

        // RFC 2822 raw mesaj — Gmail API base64url-encoded raw message bekliyor.
        var raw = BuildRfc2822(
            from: _ayarlar.SenderAddress ?? throw new InvalidOperationException("Mail__Gmail__SenderAddress gerekli."),
            fromName: _ayarlar.SenderName ?? "Geleceğin Fikri",
            to: message.Recipient,
            subject: message.Subject,
            htmlBody: message.HtmlBody);

        var content = new StringContent(
            JsonSerializer.Serialize(new { raw }),
            Encoding.UTF8,
            "application/json");

        using var istek = new HttpRequestMessage(HttpMethod.Post, GmailSendEndpoint) { Content = content };
        istek.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(15));

        HttpResponseMessage yanit;
        try
        {
            yanit = await _http.SendAsync(istek, cts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError("[GMAIL] Timeout (15sn) — alıcı={Recipient}", message.Recipient);
            throw new TimeoutException("Gmail API zaman aşımı.");
        }

        var govde = await yanit.Content.ReadAsStringAsync(cancellationToken);
        if (!yanit.IsSuccessStatusCode)
        {
            _logger.LogError("[GMAIL] Hata {Status}: {Body}", (int)yanit.StatusCode, govde);
            throw new InvalidOperationException($"Gmail API hatası ({(int)yanit.StatusCode}): {govde}");
        }

        _logger.LogInformation("[GMAIL] Gönderildi: {Recipient} | {Subject}", message.Recipient, message.Subject);
    }

    /// <summary>
    /// Access token'ı refresh_token ile alır (cache'li, 1dk yenileme eşiği).
    /// </summary>
    private async Task<string> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        await _tokenLock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedToken is { } cache && cache.Expiries > DateTimeOffset.UtcNow.AddMinutes(1))
            {
                return cache.Token;
            }

            if (string.IsNullOrWhiteSpace(_ayarlar.RefreshToken)
                || string.IsNullOrWhiteSpace(_ayarlar.ClientId)
                || string.IsNullOrWhiteSpace(_ayarlar.ClientSecret))
            {
                throw new InvalidOperationException(
                    "Gmail OAuth2 yapılandırması eksik. Mail:Gmail:ClientId / ClientSecret / RefreshToken gerekli.");
            }

            var yenile = new HttpRequestMessage(HttpMethod.Post, TokenEndpoint)
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["client_id"] = _ayarlar.ClientId!,
                    ["client_secret"] = _ayarlar.ClientSecret!,
                    ["refresh_token"] = _ayarlar.RefreshToken!,
                    ["grant_type"] = "refresh_token",
                }),
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(10));

            var yanit = await _http.SendAsync(yenile, cts.Token);
            var govde = await yanit.Content.ReadAsStringAsync(cancellationToken);
            if (!yanit.IsSuccessStatusCode)
            {
                _logger.LogError("[GMAIL] Token yenileme hatası {Status}: {Body}", (int)yanit.StatusCode, govde);
                throw new InvalidOperationException(
                    $"OAuth2 refresh_token reddedildi ({(int)yanit.StatusCode}). Refresh token geçersiz veya expire olmuş — yeniden authorize gerekli. {govde}");
            }

            var json = JsonDocument.Parse(govde);
            var accessToken = json.RootElement.GetProperty("access_token").GetString()
                ?? throw new InvalidOperationException("Google access_token döndürmedi.");
            var expiresIn = json.RootElement.TryGetProperty("expires_in", out var exp)
                ? exp.GetInt32()
                : 3600;

            _cachedToken = (accessToken, DateTimeOffset.UtcNow.AddSeconds(expiresIn));
            _logger.LogDebug("[GMAIL] Access token yenilendi (expires_in={Expires}s)", expiresIn);
            return accessToken;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    /// <summary>
    /// Gmail API'nin beklediği RFC 2822 raw mesajı üretir.
    /// </summary>
    private static string BuildRfc2822(string from, string fromName, string to, string subject, string htmlBody)
    {
        var sb = new StringBuilder();
        sb.Append("From: ").Append(fromName).Append(" <").Append(from).Append(">\r\n");
        sb.Append("To: <").Append(to).Append(">\r\n");
        sb.Append("Subject: ").Append(subject).Append("\r\n");
        sb.Append("Content-Type: text/html; charset=UTF-8\r\n");
        sb.Append("MIME-Version: 1.0\r\n");
        sb.Append("\r\n");
        sb.Append(htmlBody);

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('='); // base64url
    }
}

/// <summary>
/// appsettings.json "Mail:Gmail" bölümü + env var override (Mail__Gmail__*).
/// </summary>
public sealed class GmailAyarlari
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? RefreshToken { get; set; }
    public string? SenderAddress { get; set; }
    public string? SenderName { get; set; } = "Geleceğin Fikri";
}
