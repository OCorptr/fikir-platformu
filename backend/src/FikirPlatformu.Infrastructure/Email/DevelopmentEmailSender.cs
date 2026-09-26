using FikirPlatformu.Application.Abstractions;
using Microsoft.Extensions.Logging;

namespace FikirPlatformu.Infrastructure.Email;

/// <summary>
/// Geliştirme ortamı e-posta göndericisi: mesajları
///   1) "dev-email" klasörüne dosya olarak yazar (lokal test için),
///   2) ILogger üzerinden log'a yazar (Render container log'unda görünür —
///      SMTP yapılandırılmamış test/demo ortamları için OTP kodu log'dan okunur).
///
/// Üretimde SMTP tabanlı bir uygulama ile değiştirilir (SmtpEmailSender).
/// </summary>
public sealed class DevelopmentEmailSender : IEmailSender
{
    private readonly ILogger<DevelopmentEmailSender> _logger;

    public DevelopmentEmailSender(ILogger<DevelopmentEmailSender> logger)
    {
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        // 1) Dosyaya yaz (lokal dev için).
        Directory.CreateDirectory("dev-email");
        var dosyaAdi = $"{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.txt";
        var dosyaIcerik = $"""
            Kime: {message.Recipient}
            Konu: {message.Subject}

            {message.HtmlBody}
            """;
        await File.WriteAllTextAsync(Path.Combine("dev-email", dosyaAdi), dosyaIcerik, cancellationToken);

        // 2) Log'a yaz — Render dashboard / container log'larda görünür.
        //    HTML body'sinden OTP kodunu (6 haneli) çıkarıp ayrıca vurgula.
        var otpKodu = System.Text.RegularExpressions.Regex.Match(message.HtmlBody, @"\b\d{6}\b").Value;
        _logger.LogWarning(
            "[DEV-EMAIL] {Recipient} | {Subject}{Otp}",
            message.Recipient,
            message.Subject,
            string.IsNullOrEmpty(otpKodu) ? "" : $" | OTP={otpKodu}");
    }
}
