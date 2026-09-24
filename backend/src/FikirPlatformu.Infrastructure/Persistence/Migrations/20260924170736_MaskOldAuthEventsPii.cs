using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// Sprint 8 (YEĞİTEK gereksinim #9): eski düz metin PII içeren auth_events satırlarını maskele.
    /// Mask formatı (C# EmailMaskele ile aynı):
    ///   Email: ilk karakter + "***@" + domain
    ///   IPv4:  son oktet "***" yapılır
    /// IPv6 veya null alanlar olduğu gibi kalır.
    /// </summary>
    public partial class MaskOldAuthEventsPii : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // === EMAIL MASK ===
            // Format: a***@domain — '@' içermeyen veya zaten mask'li olmayanları maskle.
            migrationBuilder.Sql(
                "UPDATE `auth_events` " +
                "SET `email` = CONCAT(LEFT(`email`, 1), '***@', SUBSTRING(`email`, LOCATE('@', `email`) + 1)) " +
                "WHERE `email` IS NOT NULL " +
                "  AND `email` <> '' " +
                "  AND LOCATE('@', `email`) > 1 " +
                "  AND LOCATE('***@', `email`) = 0;");

            // === IPv4 MASK ===
            // Son okteti "***" ile değiştir. IPv6 (':' içeren) atlanır.
            // REGEXP_REPLACE MySQL 8.0+ ile: \\d+ son sayısal segmenti eşle.
            migrationBuilder.Sql(
                "UPDATE `auth_events` " +
                "SET `ip_address` = REGEXP_REPLACE(`ip_address`, '[0-9]+$', '***') " +
                "WHERE `ip_address` IS NOT NULL " +
                "  AND `ip_address` <> '' " +
                "  AND `ip_address` NOT LIKE '%***' " +
                "  AND LOCATE(':', `ip_address`) = 0 " +
                "  AND `ip_address` REGEXP '^[0-9.]+$';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Geri alma yok: maskeleme geri alınamaz, orijinal düz metin kaybedildi.
        }
    }
}