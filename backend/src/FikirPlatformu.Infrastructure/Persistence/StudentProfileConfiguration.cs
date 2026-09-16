using FikirPlatformu.Domain.Common;
using FikirPlatformu.Domain.Students;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class StudentProfileConfiguration : IEntityTypeConfiguration<StudentProfile>
{
    public void Configure(EntityTypeBuilder<StudentProfile> builder)
    {
        builder.ToTable("student_profiles");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(p => p.ApplicationUserId).HasColumnName("application_user_id");
        builder.Property(p => p.ProvinceId).HasColumnName("province_id");
        builder.Property(p => p.District).HasColumnName("district").HasMaxLength(60);
        builder.Property(p => p.School).HasColumnName("school").HasMaxLength(150);
        builder.Property(p => p.Grade).HasColumnName("grade");
        builder.Property(p => p.StudentNumber).HasColumnName("student_number").HasMaxLength(20);
        builder.Property(p => p.CreatedAt).HasColumnName("created_at");
        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at");

        builder.HasIndex(p => p.ApplicationUserId).IsUnique().HasDatabaseName("ux_student_profiles_user_id");
        builder.HasOne<Province>().WithMany().HasForeignKey(p => p.ProvinceId);
    }
}