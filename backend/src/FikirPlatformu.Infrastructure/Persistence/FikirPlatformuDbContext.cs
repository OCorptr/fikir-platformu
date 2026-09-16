using FikirPlatformu.Domain.Common;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Students;
using FikirPlatformu.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class FikirPlatformuDbContext(DbContextOptions<FikirPlatformuDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Idea> Ideas => Set<Idea>();
    public DbSet<IdeaCategory> IdeaCategories => Set<IdeaCategory>();
    public DbSet<StudentProfile> StudentProfiles => Set<StudentProfile>();
    public DbSet<Province> Provinces => Set<Province>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("public");
        modelBuilder.ApplyConfiguration(new IdeaConfiguration());
        modelBuilder.ApplyConfiguration(new StudentProfileConfiguration());
        modelBuilder.ApplyConfiguration(new ProvinceConfiguration());
        modelBuilder.ApplyConfiguration(new IdeaCategoryConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
