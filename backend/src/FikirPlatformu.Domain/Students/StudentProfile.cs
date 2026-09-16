namespace FikirPlatformu.Domain.Students;

public sealed class StudentProfile
{
    public Guid Id { get; set; }

    public string ApplicationUserId { get; set; } = string.Empty;

    /// <summary>Fikir gönderildiğinde kayda kopyalanan il kimliği profil alanıdır; fikir kendi province_id değerini taşır.</summary>
    public int ProvinceId { get; set; }

    public string? District { get; set; }
    public string? School { get; set; }
    public int? Grade { get; set; }
    public string? StudentNumber { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
