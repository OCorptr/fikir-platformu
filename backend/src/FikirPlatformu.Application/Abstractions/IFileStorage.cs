namespace FikirPlatformu.Application.Abstractions;

public interface IFileStorage
{
    Task<StoredFile> SaveAsync(
        string fileName,
        string contentType,
        Stream content,
        CancellationToken cancellationToken = default);

    Task<Stream> OpenReadAsync(string storageKey, CancellationToken cancellationToken = default);
}

public sealed record StoredFile(string StorageKey, string FileName, string ContentType, long Length);
