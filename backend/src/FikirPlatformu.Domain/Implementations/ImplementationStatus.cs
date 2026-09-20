using System.Text.Json.Serialization;

namespace FikirPlatformu.Domain.Implementations;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ImplementationStatus
{
    NotStarted = 0,
    InProgress = 1,
    Completed = 2,
    Failed = 3,
}
