using FikirPlatformu.Domain.Ministry;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class PeriodWinnerConfiguration : IEntityTypeConfiguration<PeriodWinner>
{
    public void Configure(EntityTypeBuilder<PeriodWinner> b)
    {
        b.ToTable("period_winners");
        b.HasKey(x => x.PeriodId);
        b.Property(x => x.PeriodId).HasColumnName("period_id");
        b.Property(x => x.IdeaId).HasColumnName("idea_id");
        b.Property(x => x.SelectedByUserId).HasColumnName("selected_by_user_id").HasMaxLength(450);
        b.Property(x => x.SelectedAt).HasColumnName("selected_at");

        b.HasOne<Period>()
            .WithMany()
            .HasForeignKey(x => x.PeriodId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.IdeaId).HasDatabaseName("ix_period_winners_idea");
    }
}