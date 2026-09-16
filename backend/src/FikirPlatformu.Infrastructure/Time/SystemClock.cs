using FikirPlatformu.Application.Abstractions;

namespace FikirPlatformu.Infrastructure.Time;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
