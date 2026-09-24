using FikirPlatformu.Domain.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class AuthEventConfiguration : IEntityTypeConfiguration<AuthEvent>
{
    public void Configure(EntityTypeBuilder<AuthEvent> b)
    {
        b.ToTable("auth_events");
        b.HasKey(x => x.Id);

        b.Property(x => x.Id).HasColumnName("id").HasColumnType("char(36)");
        b.Property(x => x.UserId).HasColumnName("user_id").HasMaxLength(255);
        b.Property(x => x.Email).HasColumnName("email").HasMaxLength(256);
        b.Property(x => x.IpAddress).HasColumnName("ip_address").HasMaxLength(45); // IPv6 max
        b.Property(x => x.UserAgent).HasColumnName("user_agent").HasMaxLength(512);
        b.Property(x => x.EventType).HasColumnName("event_type").HasConversion<int>();
        b.Property(x => x.Success).HasColumnName("success");
        b.Property(x => x.FailureReason).HasColumnName("failure_reason").HasMaxLength(120);
        b.Property(x => x.CreatedAt).HasColumnName("created_at");

        // Index: 2 yıl retention + hızlı sorgu için (plan §2.6).
        b.HasIndex(x => x.CreatedAt).HasDatabaseName("ix_auth_events_created_at");
        b.HasIndex(x => x.UserId).HasDatabaseName("ix_auth_events_user_id");
        b.HasIndex(x => new { x.EventType, x.CreatedAt }).HasDatabaseName("ix_auth_events_type_created");
    }
}
