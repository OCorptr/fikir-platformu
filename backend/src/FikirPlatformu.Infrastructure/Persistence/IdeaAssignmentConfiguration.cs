using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaAssignmentConfiguration : IEntityTypeConfiguration<IdeaAssignment>
{
    public void Configure(EntityTypeBuilder<IdeaAssignment> b)
    {
        b.ToTable("idea_assignments");
        b.HasKey(x => new { x.IdeaId, x.EvaluatorUserId });
        b.Property(x => x.IdeaId).HasColumnName("idea_id");
        b.Property(x => x.EvaluatorUserId).HasColumnName("evaluator_user_id").HasMaxLength(450);
        b.Property(x => x.AssignedByUserId).HasColumnName("assigned_by_user_id").HasMaxLength(450);
        b.Property(x => x.AssignedAt).HasColumnName("assigned_at");

        b.HasIndex(x => x.EvaluatorUserId).HasDatabaseName("ix_idea_assignments_evaluator");
    }
}
