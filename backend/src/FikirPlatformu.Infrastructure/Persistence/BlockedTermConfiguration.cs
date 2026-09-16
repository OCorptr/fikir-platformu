using FikirPlatformu.Domain.Moderation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class BlockedTermConfiguration : IEntityTypeConfiguration<BlockedTerm>
{
    public void Configure(EntityTypeBuilder<BlockedTerm> builder)
    {
        builder.ToTable("blocked_terms");
        builder.HasKey(term => term.Id);
        builder.Property(term => term.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(term => term.Term).HasColumnName("term").HasMaxLength(120).IsRequired();
        builder.Property(term => term.NormalizedTerm)
            .HasColumnName("normalized_term")
            .HasMaxLength(120)
            .IsRequired();
        builder.Property(term => term.Action)
            .HasColumnName("action")
            .HasConversion<string>()
            .HasMaxLength(16);
        builder.Property(term => term.IsActive).HasColumnName("is_active");
        builder.Property(term => term.CreatedAt).HasColumnName("created_at");
        builder.Property(term => term.UpdatedAt).HasColumnName("updated_at");

        builder.HasIndex(term => term.NormalizedTerm)
            .IsUnique()
            .HasDatabaseName("ux_blocked_terms_normalized_term");
    }
}
