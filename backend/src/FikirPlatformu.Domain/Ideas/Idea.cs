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
        UpdatedAt = createdAt;
        Status = IdeaSubmissionStatus.Draft;
    }

    public Guid StudentId { get; private set; }

    public int ProvinceId { get; private set; }

    public int CategoryId { get; private set; }

    public string Content { get; private set; } = string.Empty;

    public IdeaSubmissionStatus Status { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

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

    public void UpdateDraft(int categoryId, string content, DateTimeOffset updatedAt)
    {
        EnsureDraft();

        if (categoryId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(categoryId), "Kategori seçimi zorunludur.");
        }

        CategoryId = categoryId;
        Content = NormalizeContent(content);
        UpdatedAt = updatedAt;
    }

    public void Submit(int provinceId, DateTimeOffset submittedAt)
    {
        EnsureDraft();

        if (provinceId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(provinceId), "İl seçimi zorunludur.");
        }

        if (string.IsNullOrWhiteSpace(Content))
        {
            throw new InvalidOperationException("Boş fikir gönderilemez.");
        }

        ProvinceId = provinceId;
        Status = IdeaSubmissionStatus.Submitted;
        SubmittedAt = submittedAt;
        UpdatedAt = submittedAt;
    }

    public void DeleteDraft(DateTimeOffset deletedAt)
    {
        EnsureDraft();
        Status = IdeaSubmissionStatus.Deleted;
        UpdatedAt = deletedAt;
    }

    private static string NormalizeContent(string content)
    {
        ArgumentNullException.ThrowIfNull(content);

        if (content.Length > MaxContentLength)
        {
            throw new ArgumentOutOfRangeException(
                nameof(content),
                $"Fikir metni en fazla {MaxContentLength} karakter olabilir.");
        }

        return content.Trim();
    }

    private void EnsureDraft()
    {
        if (Status != IdeaSubmissionStatus.Draft)
        {
            throw new InvalidOperationException("Yalnızca taslak fikir değiştirilebilir.");
        }
    }
}
