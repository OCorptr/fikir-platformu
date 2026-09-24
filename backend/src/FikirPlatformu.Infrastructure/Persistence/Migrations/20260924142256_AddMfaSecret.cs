using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMfaSecret : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TwoFactorSecret",
                table: "AspNetUsers",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TwoFactorSecret",
                table: "AspNetUsers");
        }
    }
}
