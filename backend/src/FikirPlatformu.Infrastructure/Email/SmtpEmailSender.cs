using FikirPlatformu.Application.Abstractions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FikirPlatformu.Infrastructure.Email;

/// <summary>
/// Üretim e-posta göndericisi — appsettings.json'daki "Mail" bölümünü kullanır.
/// Render gibi platformlarda environment variable'larla override edilir:
///   Mail__Host, Mail__Port, Mail__User, Mail__Pass, Mail__From
///
/// Desteklenen sağlayıcılar (smtp host/port kimliği):
///   - Resend       : smtp.resend.com:587 (STARTTLS) user=resend pass=API_KEY
///   - Gmail SMTP   : smtp.gmail.com:587 App Password gerekir
///   - SendGrid SMTP: smtp.sendgrid.net:587 user=apikey pass=API_KEY
///   - Outlook SMTP : smtp-mail.outlook.com:587
/// </summary>
public sealed class SmtpEmailSender : IEmailSender
{
    private readonly MailAyarlari _ayarlar;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<MailAyarlari> ayarlar, ILogger<SmtpEmailSender> logger)
    {
        _ayarlar = ayarlar.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        var host = _ayarlar.Host;
        var port = _ayarlar.Port;
        if (string.IsNullOrWhiteSpace(host))
        {
            _logger.LogError("[SMTP] Mail:Host ayarlanmamış — gönderim atlandı (kime={Recipient})", message.Recipient);
            throw new InvalidOperationException("SMTP host yapılandırılmamış. Mail:Host environment variable gerekli.");
        }

        using var smtp = new System.Net.Mail.SmtpClient(host, port)
        {
            EnableSsl = _ayarlar.UseStartTls,
            Credentials = new System.Net.NetworkCredential(_ayarlar.User ?? "", _ayarlar.Pass ?? ""),
            Timeout = 15_000,
        };

        var mail = new System.Net.Mail.MailMessage
        {
            From = new System.Net.Mail.MailAddress(_ayarlar.From, _ayarlar.FromName ?? "Geleceğin Fikri"),
            Subject = message.Subject,
            Body = message.HtmlBody,
            IsBodyHtml = true,
            BodyEncoding = System.Text.Encoding.UTF8,
            SubjectEncoding = System.Text.Encoding.UTF8,
        };
        mail.To.Add(message.Recipient);

        // Attachment varsa ekle
        if (message.Attachments is { Count: > 0 })
        {
            foreach (var ek in message.Attachments)
            {
                var stream = new System.IO.MemoryStream(ek.Content.ToArray());
                mail.Attachments.Add(new System.Net.Mail.Attachment(stream, ek.FileName, ek.ContentType));
            }
        }

        await smtp.SendMailAsync(mail, cancellationToken);
        _logger.LogInformation("[SMTP] Gönderildi: {Recipient} | {Subject}", message.Recipient, message.Subject);
    }
}

/// <summary>
/// appsettings.json "Mail" bölümü + environment variable override.
/// </summary>
public sealed class MailAyarlari
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public bool UseStartTls { get; set; } = true;
    public string? User { get; set; }
    public string? Pass { get; set; }
    public string? From { get; set; }
    public string? FromName { get; set; } = "Geleceğin Fikri";
}
