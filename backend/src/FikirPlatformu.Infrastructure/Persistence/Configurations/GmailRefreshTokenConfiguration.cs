using FikirPlatformu.Infrastructure.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence.Configurations;

/// <summary>
/// gmail_refresh_tokens tablosu konfigürasyonu.
/// Tek satır (Id=1) — Sistem Sabit Gmail'i pattern'i.
/// Migrations'da upsert mantığı: id=1 insert ya da update.
/// </summary>
public sealed class GmailRefreshTokenConfiguration : IEntityTypeConfiguration<GmailRefreshToken>
{
    public void Configure(EntityTypeBuilder<GmailRefreshToken> b)
    {
        b.ToTable("gmail_refresh_tokens");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever(); // explicit PK
        b.Property(x => x.EncryptedRefreshToken)
            .HasColumnType("text")
            .IsRequired();
        b.Property(x => x.UpdatedAt)
            .HasColumnType("datetime(6)")
            .IsRequired();
    }
}
