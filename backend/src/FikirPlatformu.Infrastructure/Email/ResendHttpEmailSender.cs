using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FikirPlatformu.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FikirPlatformu.Infrastructure.Email;

/// <summary>
/// Resend HTTPS API üzerinden e-posta gönderir (port 443 — Render/SaaS ortamlarında
/// SMTP portları bloklanmaz). En garantili yöntem.
///
/// Kurulum:
///   1) https://resend.com/signup (GitHub signup — 2dk, ücretsiz 100 mail/gün + 3000/ay)
///   2) Domain doğrula veya test için onboarding@resend.dev kullan
///   3) API Key oluştur (Sending access yetkisi)
///   4) Render Environment Variables:
///        Mail__Type=resend           (bu sınıfı seç)
///        Mail__ApiKey=re_xxx        (Resend API key)
///        Mail__From=onboarding@resend.dev  veya kendi doğrulanmış domain
///        Mail__FromName=Geleceğin Fikri
///
/// Gmail SMTP'ye göre avantajları:
///   - SMTP port (25/465/587) bloklanmaz — HTTPS 443 garantili
///   - Google App Password gerekmez
///   - Hız: <500ms (SMTP handshake yok)
///   - Teslimat istatistikleri dashboard'da
/// </summary>
public sealed class ResendHttpEmailSender : IEmailSender
{
    public const string SaglayiciTipi = "resend";

    private readonly HttpClient _http;
    private readonly MailAyarlari _ayarlar;
    private readonly ILogger<ResendHttpEmailSender> _logger;

    public ResendHttpEmailSender(HttpClient http, IOptions<MailAyarlari> ayarlar, ILogger<ResendHttpEmailSender> logger)
    {
        _http = http;
        _ayarlar = ayarlar.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_ayarlar.Pass))
        {
            _logger.LogError("[RESEND] Mail:Pass (API key) ayarlanmamış.");
            throw new InvalidOperationException("Resend API key gerekli (Mail:Pass).");
        }
        if (string.IsNullOrWhiteSpace(_ayarlar.From))
        {
            _logger.LogError("[RESEND] Mail:From ayarlanmamış.");
            throw new InvalidOperationException("Mail:From (sender adresi) gerekli.");
        }

        var endpoint = new Uri("https://api.resend.com/emails");
        var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    from = string.IsNullOrWhiteSpace(_ayarlar.FromName)
                        ? _ayarlar.From
                        : $"{_ayarlar.FromName} <{_ayarlar.From}>",
                    to = new[] { message.Recipient },
                    subject = message.Subject,
                    html = message.HtmlBody,
                }),
                Encoding.UTF8,
                "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _ayarlar.Pass);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(15));

        HttpResponseMessage yanit;
        try
        {
            yanit = await _http.SendAsync(request, cts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError("[RESEND] Timeout (15sn) — alıcı={Recipient}", message.Recipient);
            throw new TimeoutException("Resend API zaman aşımı.");
        }

        var govde = await yanit.Content.ReadAsStringAsync(cancellationToken);
        if (!yanit.IsSuccessStatusCode)
        {
            _logger.LogError("[RESEND] Hata {Status}: {Body}", (int)yanit.StatusCode, govde);
            throw new InvalidOperationException($"Resend API hatası ({(int)yanit.StatusCode}): {govde}");
        }

        _logger.LogInformation("[RESEND] Gönderildi: {Recipient} | {Subject}", message.Recipient, message.Subject);
    }
}
