namespace FikirPlatformu.Domain.Identity;

/// <summary>
/// Bir kullanıcının (ProvinceManager veya ProvinceEvaluator) hangi ile atandığını tutar.
/// Plan Sprint 6 §42 #3 düzeltmesi: tüm manager/evaluator artık belirli bir ile bağlı,
/// İstanbul'a sabit değil. Her il için 1 manager + N evaluator.
/// </summary>
public sealed class ProvinceUserAssignment
{
    public Guid Id { get; private set; }
    public string UserId { get; private set; } = string.Empty;
    public int ProvinceId { get; private set; }
    /// <summary>"ProvinceManager" veya "ProvinceEvaluator".</summary>
    public string Role { get; private set; } = string.Empty;
    /// <summary>Manager için null (kendisi atanır), evaluator için atayan manager UserId'si.</summary>
    public string? AssignedByUserId { get; private set; }
    public DateTimeOffset AssignedAt { get; private set; }

    public static ProvinceUserAssignment Create(
        string userId,
        int provinceId,
        string role,
        string? assignedByUserId,
        DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(userId)) throw new ArgumentException("userId zorunludur.", nameof(userId));
        if (provinceId <= 0) throw new ArgumentOutOfRangeException(nameof(provinceId), "İl zorunludur.");
        if (role != "ProvinceManager" && role != "ProvinceEvaluator")
            throw new ArgumentException("Sadece ProvinceManager veya ProvinceEvaluator atanabilir.", nameof(role));
        return new ProvinceUserAssignment
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ProvinceId = provinceId,
            Role = role,
            AssignedByUserId = assignedByUserId,
            AssignedAt = now,
        };
    }
}