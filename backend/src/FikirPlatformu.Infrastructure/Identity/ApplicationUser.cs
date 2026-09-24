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

    /// <summary>
    /// TOTP MFA için base32 secret (plan §2.7 — Sprint 6).
    /// TwoFactorEnabled IdentityUser'dan miras; secret burada.
    /// NULL = MFA henüz kurulmamış VEYA Email OTP yöntemi seçilmiş (secret gerekmez).
    /// </summary>
    public string? TwoFactorSecret { get; set; }

    /// <summary>
    /// Kullanıcının tercih ettiği MFA yöntemi (Sprint 10).
    /// TOTP = Authenticator app (secret TwoFactorSecret'de saklanır).
    /// Email = E-posta OTP (her girişte yeni kod gönderilir, secret saklanmaz).
    /// </summary>
    public TwoFactorMethod TwoFactorMethod { get; set; } = TwoFactorMethod.None;
}

public enum TwoFactorMethod
{
    None = 0,
    Totp = 1,
    Email = 2
}
