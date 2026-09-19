using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProvinceInboxReadAndAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "idea_assignments",
                schema: "public",
                columns: table => new
                {
                    idea_id = table.Column<Guid>(type: "uuid", nullable: false),
                    evaluator_user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    assigned_by_user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idea_assignments", x => new { x.idea_id, x.evaluator_user_id });
                });

            migrationBuilder.CreateTable(
                name: "idea_read_receipts",
                schema: "public",
                columns: table => new
                {
                    idea_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idea_read_receipts", x => new { x.idea_id, x.user_id });
                });

            migrationBuilder.CreateIndex(
                name: "ix_idea_assignments_evaluator",
                schema: "public",
                table: "idea_assignments",
                column: "evaluator_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_idea_read_receipts_user_id",
                schema: "public",
                table: "idea_read_receipts",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "idea_assignments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "idea_read_receipts",
                schema: "public");
        }
    }
}
