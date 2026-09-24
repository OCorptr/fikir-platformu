using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OptimizeIdeaIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ideas_category_id",
                table: "ideas");

            migrationBuilder.CreateIndex(
                name: "ix_ideas_category_submitted",
                table: "ideas",
                columns: new[] { "category_id", "submitted_at" });

            migrationBuilder.CreateIndex(
                name: "ix_ideas_province_submitted",
                table: "ideas",
                columns: new[] { "province_id", "submitted_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_ideas_category_submitted",
                table: "ideas");

            migrationBuilder.DropIndex(
                name: "ix_ideas_province_submitted",
                table: "ideas");

            migrationBuilder.CreateIndex(
                name: "IX_ideas_category_id",
                table: "ideas",
                column: "category_id");
        }
    }
}
