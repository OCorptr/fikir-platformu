using Microsoft.AspNetCore.Identity;

namespace FikirPlatformu.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;

    /// <summary>Şifre en son ne zaman değiştirildi (plan §2.4: 90 günlük süre sonu).</summary>
    public DateTimeOffset? PasswordChangedAt { get; set; }

    /// <summary>İlk girişte kullanıcı şifresini değiştirmeye zorlanmalı (plan §2.5).</summary>
    public bool MustChangePassword { get; set; }
}
