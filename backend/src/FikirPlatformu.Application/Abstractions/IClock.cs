namespace FikirPlatformu.Application.Abstractions;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
