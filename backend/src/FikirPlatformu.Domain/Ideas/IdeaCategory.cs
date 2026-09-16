namespace FikirPlatformu.Domain.Ideas;

public sealed class IdeaCategory
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
