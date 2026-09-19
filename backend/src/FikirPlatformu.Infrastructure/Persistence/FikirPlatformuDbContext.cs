using FikirPlatformu.Domain.Common;
using FikirPlatformu.Domain.Evaluations;
using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Ministry;
using FikirPlatformu.Domain.Moderation;
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
    public DbSet<BlockedTerm> BlockedTerms => Set<BlockedTerm>();
    public DbSet<IdeaReadReceipt> IdeaReadReceipts => Set<IdeaReadReceipt>();
    public DbSet<IdeaAssignment> IdeaAssignments => Set<IdeaAssignment>();
    public DbSet<Evaluation> Evaluations => Set<Evaluation>();
    public DbSet<Period> Periods => Set<Period>();
    public DbSet<PeriodSelection> PeriodSelections => Set<PeriodSelection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("public");
        modelBuilder.ApplyConfiguration(new IdeaConfiguration());
        modelBuilder.ApplyConfiguration(new StudentProfileConfiguration());
        modelBuilder.ApplyConfiguration(new ProvinceConfiguration());
        modelBuilder.ApplyConfiguration(new IdeaCategoryConfiguration());
        modelBuilder.ApplyConfiguration(new BlockedTermConfiguration());
        modelBuilder.ApplyConfiguration(new IdeaReadReceiptConfiguration());
        modelBuilder.ApplyConfiguration(new IdeaAssignmentConfiguration());
        modelBuilder.ApplyConfiguration(new EvaluationConfiguration());
        modelBuilder.ApplyConfiguration(new PeriodConfiguration());
        modelBuilder.ApplyConfiguration(new PeriodSelectionConfiguration());
        base.OnModelCreating(modelBuilder);
    }
}
