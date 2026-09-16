using FikirPlatformu.Application.Abstractions;

namespace FikirPlatformu.Infrastructure.Email;

/// <summary>
/// Gelistirme ortami e-posta gondericisi: mesajlari "dev-email" klasorune dosya olarak yazar.
/// Uretimde SMTP tabanli bir uygulama ile degiştirilir.
/// </summary>
public sealed class DevelopmentEmailSender : IEmailSender
{
    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        Directory.CreateDirectory("dev-email");
        var dosyaAdi = $"{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss-fff}-{Guid.NewGuid():N}.txt";
        var icerik = $"""
            Kime: {message.Recipient}
            Konu: {message.Subject}

            {message.HtmlBody}
            """;
        await File.WriteAllTextAsync(Path.Combine("dev-email", dosyaAdi), icerik, cancellationToken);
    }
}