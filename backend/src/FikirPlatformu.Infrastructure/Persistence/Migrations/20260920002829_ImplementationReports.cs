using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ImplementationReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "implementation_reports",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    idea_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    reported_by_user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    reported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_implementation_reports", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_implementation_reports_idea",
                schema: "public",
                table: "implementation_reports",
                column: "idea_id");

            migrationBuilder.CreateIndex(
                name: "ix_implementation_reports_idea_reported_at",
                schema: "public",
                table: "implementation_reports",
                columns: new[] { "idea_id", "reported_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "implementation_reports",
                schema: "public");
        }
    }
}
