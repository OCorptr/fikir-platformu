using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaReadReceiptConfiguration : IEntityTypeConfiguration<IdeaReadReceipt>
{
    public void Configure(EntityTypeBuilder<IdeaReadReceipt> b)
    {
        b.ToTable("idea_read_receipts");
        b.HasKey(x => new { x.IdeaId, x.UserId });
        b.Property(x => x.IdeaId).HasColumnName("idea_id");
        b.Property(x => x.UserId).HasColumnName("user_id").HasMaxLength(450);
        b.Property(x => x.ReadAt).HasColumnName("read_at");

        b.HasIndex(x => x.UserId).HasDatabaseName("ix_idea_read_receipts_user_id");
    }
}
