using FikirPlatformu.Domain.Ministry;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class PeriodConfiguration : IEntityTypeConfiguration<Period>
{
    public void Configure(EntityTypeBuilder<Period> b)
    {
        b.ToTable("periods");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        b.Property(x => x.Label).HasColumnName("label").HasMaxLength(120).IsRequired();
        b.Property(x => x.StartAt).HasColumnName("start_at");
        b.Property(x => x.EndAt).HasColumnName("end_at");
        b.Property(x => x.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(32);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");

        b.HasIndex(x => x.Status).HasDatabaseName("ix_periods_status");
    }
}
