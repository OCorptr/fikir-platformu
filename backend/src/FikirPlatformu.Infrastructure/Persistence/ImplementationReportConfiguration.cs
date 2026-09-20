using FikirPlatformu.Domain.Implementations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class ImplementationReportConfiguration : IEntityTypeConfiguration<ImplementationReport>
{
    public void Configure(EntityTypeBuilder<ImplementationReport> b)
    {
        b.ToTable("implementation_reports");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        b.Property(x => x.IdeaId).HasColumnName("idea_id");
        b.Property(x => x.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(32);
        b.Property(x => x.Note).HasColumnName("note").HasMaxLength(2000).IsRequired();
        b.Property(x => x.ReportedByUserId).HasColumnName("reported_by_user_id").HasMaxLength(450);
        b.Property(x => x.ReportedAt).HasColumnName("reported_at");

        b.HasIndex(x => x.IdeaId).HasDatabaseName("ix_implementation_reports_idea");
        b.HasIndex(x => new { x.IdeaId, x.ReportedAt }).HasDatabaseName("ix_implementation_reports_idea_reported_at");
    }
}
