namespace FikirPlatformu.Application.Abstractions;

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

public sealed record EmailMessage(
    string Recipient,
    string Subject,
    string HtmlBody,
    IReadOnlyCollection<EmailAttachment>? Attachments = null);

public sealed record EmailAttachment(
    string FileName,
    string ContentType,
    ReadOnlyMemory<byte> Content);
