using System.Collections.Concurrent;

namespace FikirPlatformu.Api.Endpoints;

/// <summary>
/// Email OTP kodları için in-memory store (Sprint 10).
/// Her kod 5 dakika geçerli, tek kullanımlık. Container restart'ta sıfırlanır — kabul edilebilir,
/// çünkü kodlar 5dk içinde expire olur ve yeni login attempt'inde yeni kod üretilir.
/// Production'da Redis gibi persistent store'a geçirilebilir (cluster deployment için).
/// </summary>
public sealed class EmailOtpStore
{
    public sealed record OtpEntry(string Code, DateTime ExpiresAt, int AttemptCount);
    private const int MaxAttempts = 5;
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan CleanupInterval = TimeSpan.FromMinutes(1);

    private readonly ConcurrentDictionary<string, OtpEntry> _entries = new();
    private DateTime _lastCleanup = DateTime.UtcNow;

    /// <summary>Yeni OTP kodu üretir, store'a kaydeder, kodu döner (e-posta ile gönderilecek).</summary>
    public string IssueCode(string userId)
    {
        // Önce expire olmuş entry'leri temizle
        Cleanup();

        // 6 hane numeric kod, leading zeros korunur
        var code = Random.Shared.Next(0, 1_000_000).ToString("D6");
        var entry = new OtpEntry(code, DateTime.UtcNow.Add(Lifetime), AttemptCount: 0);
        _entries[userId] = entry;
        return code;
    }

    /// <summary>Kodu doğrular. Başarılıysa entry silinir (tek kullanımlık).</summary>
    public bool Verify(string userId, string code)
    {
        Cleanup();

        if (!_entries.TryGetValue(userId, out var entry))
            return false;

        // Expire kontrolü
        if (entry.ExpiresAt < DateTime.UtcNow)
        {
            _entries.TryRemove(userId, out _);
            return false;
        }

        // Brute force koruması: 5 yanlış denemeden sonra entry silinir
        if (entry.AttemptCount >= MaxAttempts)
        {
            _entries.TryRemove(userId, out _);
            return false;
        }

        // Sabit zamanlı karşılaştırma (timing attack koruması)
        if (!CryptographicEquals(entry.Code, code))
        {
            // AttemptCount artır
            _entries.TryUpdate(userId,
                entry with { AttemptCount = entry.AttemptCount + 1 },
                entry);
            return false;
        }

        // Başarılı — entry sil
        _entries.TryRemove(userId, out _);
        return true;
    }

    private static bool CryptographicEquals(string a, string b)
    {
        var ab = System.Text.Encoding.UTF8.GetBytes(a);
        var bb = System.Text.Encoding.UTF8.GetBytes(b);
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(ab, bb);
    }

    private void Cleanup()
    {
        var now = DateTime.UtcNow;
        if (now - _lastCleanup < CleanupInterval) return;
        _lastCleanup = now;
        foreach (var kv in _entries)
        {
            if (kv.Value.ExpiresAt < now)
                _entries.TryRemove(kv.Key, out _);
        }
    }
}
