namespace FikirPlatformu.Application.Abstractions;

public interface IDocumentGenerator
{
    Task<GeneratedDocument> GenerateCertificateAsync(
        CertificateDocumentData data,
        CancellationToken cancellationToken = default);
}

public sealed record CertificateDocumentData(
    string StudentName,
    string SchoolName,
    string ProvinceName,
    string CategoryName,
    string SelectionPeriod,
    string CertificateNumber);

public sealed record GeneratedDocument(
    string FileName,
    string ContentType,
    ReadOnlyMemory<byte> Content);
