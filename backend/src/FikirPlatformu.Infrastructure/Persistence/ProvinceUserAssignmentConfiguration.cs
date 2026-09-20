using FikirPlatformu.Domain.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class ProvinceUserAssignmentConfiguration : IEntityTypeConfiguration<ProvinceUserAssignment>
{
    public void Configure(EntityTypeBuilder<ProvinceUserAssignment> b)
    {
        b.ToTable("province_user_assignments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).HasColumnName("id");
        b.Property(x => x.UserId).HasColumnName("user_id").HasMaxLength(450).IsRequired();
        b.Property(x => x.ProvinceId).HasColumnName("province_id").IsRequired();
        b.Property(x => x.Role).HasColumnName("role").HasMaxLength(50).IsRequired();
        b.Property(x => x.AssignedByUserId).HasColumnName("assigned_by_user_id").HasMaxLength(450);
        b.Property(x => x.AssignedAt).HasColumnName("assigned_at");

        // Bir kullanici bir rolde sadece 1 ile atanabilir
        b.HasIndex(x => new { x.UserId, x.Role }).IsUnique().HasDatabaseName("ux_province_user_user_role");
        // Bir ilde en fazla 1 manager (idari kısıt)
        b.HasIndex(x => new { x.ProvinceId, x.Role })
            .IsUnique()
            .HasFilter("role = 'ProvinceManager'")
            .HasDatabaseName("ux_province_user_one_manager");
        b.HasIndex(x => x.ProvinceId).HasDatabaseName("ix_province_user_province");
    }
}