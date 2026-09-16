using FikirPlatformu.Domain.Ideas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FikirPlatformu.Infrastructure.Persistence;

public sealed class IdeaCategoryConfiguration : IEntityTypeConfiguration<IdeaCategory>
{
    public void Configure(EntityTypeBuilder<IdeaCategory> builder)
    {
        builder.ToTable("idea_categories");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(c => c.Name).HasColumnName("name").HasMaxLength(80).IsRequired();
        builder.Property(c => c.IsActive).HasColumnName("is_active");

        builder.HasData(
        new IdeaCategory { Id = 1, Name = "Kültür ve Sanat", IsActive = true },
        new IdeaCategory { Id = 2, Name = "Spor ve Sağlıklı Yaşam", IsActive = true },
        new IdeaCategory { Id = 3, Name = "Bilim ve Teknoloji", IsActive = true },
        new IdeaCategory { Id = 4, Name = "Yapay Zekâ", IsActive = true },
        new IdeaCategory { Id = 5, Name = "Çevre ve Sürdürülebilirlik", IsActive = true },
        new IdeaCategory { Id = 6, Name = "Sosyal Sorumluluk", IsActive = true },
        new IdeaCategory { Id = 7, Name = "Girişimcilik", IsActive = true },
        new IdeaCategory { Id = 8, Name = "Afet Farkındalığı ve Güvenli Yaşam", IsActive = true },
        new IdeaCategory { Id = 9, Name = "Değerler Eğitimi", IsActive = true },
        new IdeaCategory { Id = 10, Name = "Yerli ve Millî Üretim – Millî Savunma", IsActive = true }
        );
    }
}