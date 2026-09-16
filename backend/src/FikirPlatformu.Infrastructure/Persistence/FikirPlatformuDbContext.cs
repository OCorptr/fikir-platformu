using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class FikirPlatformuDbContext(DbContextOptions<FikirPlatformuDbContext> options)
    : DbContext(options)
{
    public DbSet<Idea> Ideas => Set<Idea>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("public");
        modelBuilder.ApplyConfiguration(new IdeaConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
