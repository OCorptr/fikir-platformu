using FikirPlatformu.Domain.Evaluations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class EvaluationConfiguration : IEntityTypeConfiguration<Evaluation>
{
    public void Configure(EntityTypeBuilder<Evaluation> b)
    {
        b.ToTable("idea_evaluations");
        b.HasKey(x => new { x.IdeaId, x.EvaluatorUserId, x.Criterion });
        b.Property(x => x.IdeaId).HasColumnName("idea_id");
        b.Property(x => x.EvaluatorUserId).HasColumnName("evaluator_user_id").HasMaxLength(450);
        b.Property(x => x.Criterion)
            .HasColumnName("criterion")
            .HasConversion<string>()
            .HasMaxLength(32);
        b.Property(x => x.Score).HasColumnName("score");
        b.Property(x => x.Comment).HasColumnName("comment").HasMaxLength(2000);
        b.Property(x => x.EvaluatedAt).HasColumnName("evaluated_at");

        b.HasIndex(x => x.EvaluatorUserId).HasDatabaseName("ix_idea_evaluations_evaluator");
        b.HasIndex(x => new { x.IdeaId, x.Criterion }).HasDatabaseName("ix_idea_evaluations_idea_criterion");
    }
}
