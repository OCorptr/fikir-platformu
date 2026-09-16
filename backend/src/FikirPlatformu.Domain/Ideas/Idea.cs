using FikirPlatformu.Domain.Common;

namespace FikirPlatformu.Domain.Ideas;

public sealed class Idea : Entity
{
    public const int MaxContentLength = 1_500;

    private Idea()
    {
    }

    private Idea(
        Guid studentId,
        int provinceId,
        int categoryId,
        string content,
        DateTimeOffset createdAt)
    {
        StudentId = studentId;
        ProvinceId = provinceId;
        CategoryId = categoryId;
        Content = NormalizeContent(content);
        CreatedAt = createdAt;
        Status = IdeaSubmissionStatus.Draft;
    }

    public Guid StudentId { get; private set; }

    public int ProvinceId { get; private set; }

    public int CategoryId { get; private set; }

    public string Content { get; private set; } = string.Empty;

    public IdeaSubmissionStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public static Idea CreateDraft(
        Guid studentId,
        int provinceId,
        int categoryId,
        string content,
        DateTimeOffset createdAt)
    {
        if (studentId == Guid.Empty)
        {
            throw new ArgumentException("Öğrenci kimliği zorunludur.", nameof(studentId));
        }

        if (provinceId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(provinceId), "İl seçimi zorunludur.");
        }

        if (categoryId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(categoryId), "Kategori seçimi zorunludur.");
        }

        return new Idea(studentId, provinceId, categoryId, content, createdAt);
    }

    public void UpdateContent(string content)
    {
        EnsureDraft();
        Content = NormalizeContent(content);
    }

    public void Submit(DateTimeOffset submittedAt)
    {
        EnsureDraft();

        if (string.IsNullOrWhiteSpace(Content))
        {
            throw new InvalidOperationException("Boş fikir gönderilemez.");
        }

        Status = IdeaSubmissionStatus.Submitted;
        SubmittedAt = submittedAt;
    }

    private static string NormalizeContent(string content)
    {
        ArgumentNullException.ThrowIfNull(content);

        var normalized = content.Trim();
        if (normalized.Length > MaxContentLength)
        {
            throw new ArgumentOutOfRangeException(
                nameof(content),
                $"Fikir metni en fazla {MaxContentLength} karakter olabilir.");
        }

        return normalized;
    }

    private void EnsureDraft()
    {
        if (Status != IdeaSubmissionStatus.Draft)
        {
            throw new InvalidOperationException("Yalnızca taslak fikir değiştirilebilir.");
        }
    }
}
