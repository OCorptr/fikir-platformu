using FikirPlatformu.Domain.Ministry;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class PeriodSelectionConfiguration : IEntityTypeConfiguration<PeriodSelection>
{
    public void Configure(EntityTypeBuilder<PeriodSelection> b)
    {
        b.ToTable("period_selections");
        b.HasKey(x => new { x.PeriodId, x.CategoryId });
        b.Property(x => x.PeriodId).HasColumnName("period_id");
        b.Property(x => x.CategoryId).HasColumnName("category_id");
        b.Property(x => x.IdeaId).HasColumnName("idea_id");
        b.Property(x => x.SelectedByUserId).HasColumnName("selected_by_user_id").HasMaxLength(450);
        b.Property(x => x.SelectedAt).HasColumnName("selected_at");

        // Bir dönemde her kategoriden en fazla 1 seçim.
        b.HasIndex(x => new { x.PeriodId, x.CategoryId }).IsUnique().HasDatabaseName("ux_period_selections_period_category");
        b.HasIndex(x => x.IdeaId).HasDatabaseName("ix_period_selections_idea");
    }
}
