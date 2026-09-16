using FikirPlatformu.Domain.Ideas;
using FikirPlatformu.Domain.Common;
using FikirPlatformu.Domain.Students;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaConfiguration : IEntityTypeConfiguration<Idea>
{
    public void Configure(EntityTypeBuilder<Idea> builder)
    {
        builder.ToTable("ideas");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(i => i.StudentId).HasColumnName("student_id");
        builder.Property(i => i.ProvinceId).HasColumnName("province_id");
        builder.Property(i => i.CategoryId).HasColumnName("category_id");
        builder.Property(i => i.Content).HasColumnName("content").HasMaxLength(Idea.MaxContentLength);
        builder.Property(i => i.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(32);
        builder.Property(i => i.CreatedAt).HasColumnName("created_at");
        builder.Property(i => i.UpdatedAt).HasColumnName("updated_at");
        builder.Property(i => i.SubmittedAt).HasColumnName("submitted_at");

        builder.HasIndex(i => i.StudentId).HasDatabaseName("ix_ideas_student_id");
        builder.HasIndex(i => new { i.ProvinceId, i.Status }).HasDatabaseName("ix_ideas_province_status");
        builder.HasIndex(i => i.SubmittedAt).HasDatabaseName("ix_ideas_submitted_at");

        builder.HasOne<StudentProfile>()
            .WithMany()
            .HasForeignKey(i => i.StudentId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Province>()
            .WithMany()
            .HasForeignKey(i => i.ProvinceId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<IdeaCategory>()
            .WithMany()
            .HasForeignKey(i => i.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
