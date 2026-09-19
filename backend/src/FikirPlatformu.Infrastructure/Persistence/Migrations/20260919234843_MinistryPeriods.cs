using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MinistryPeriods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "period_selections",
                schema: "public",
                columns: table => new
                {
                    period_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<int>(type: "integer", nullable: false),
                    idea_id = table.Column<Guid>(type: "uuid", nullable: false),
                    selected_by_user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    selected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_period_selections", x => new { x.period_id, x.category_id });
                });

            migrationBuilder.CreateTable(
                name: "periods",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    label = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    start_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_periods", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_period_selections_idea",
                schema: "public",
                table: "period_selections",
                column: "idea_id");

            migrationBuilder.CreateIndex(
                name: "ux_period_selections_period_category",
                schema: "public",
                table: "period_selections",
                columns: new[] { "period_id", "category_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_periods_status",
                schema: "public",
                table: "periods",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "period_selections",
                schema: "public");

            migrationBuilder.DropTable(
                name: "periods",
                schema: "public");
        }
    }
}
