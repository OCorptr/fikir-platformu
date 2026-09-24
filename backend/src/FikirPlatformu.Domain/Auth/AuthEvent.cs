namespace FikirPlatformu.Domain.Auth;

/// <summary>
/// Kimlik doğrulama olayları audit log tablosu (plan §2.6 + resim: "Başarılı/başarısız kimlik doğrulama girişimleri izlenir ve kayıt altına alınır").
/// 2 yıl retention (plan §1.7).
/// </summary>
public sealed class AuthEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string? UserId { get; set; }                  // Identity AspNetUsers.Id (nullable — bilinmeyen email girişimleri için)
    public string? Email { get; set; }                  // girişimde kullanılan email
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public AuthEventType EventType { get; set; }         // LoginSuccess, LoginFailure, LoginLockedOut, Logout, etc.
    public bool Success { get; set; }
    public string? FailureReason { get; set; }          // başarısız girişimde (örn: "yanlis_sifre", "kilitli", "email_bulunamadi")
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum AuthEventType
{
    LoginSuccess = 1,
    LoginFailure = 2,        // Invalid credentials (email veya şifre yanlış)
    LoginLockedOut = 3,      // Lockout tetiklendi
    LoginEmailNotConfirmed = 4,
    Logout = 10,
    PasswordChanged = 20,
    MfaEnabled = 30,
    MfaDisabled = 31,
}
