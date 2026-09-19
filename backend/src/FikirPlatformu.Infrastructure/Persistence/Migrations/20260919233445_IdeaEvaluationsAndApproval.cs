using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IdeaEvaluationsAndApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "idea_evaluations",
                schema: "public",
                columns: table => new
                {
                    idea_id = table.Column<Guid>(type: "uuid", nullable: false),
                    evaluator_user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    criterion = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    evaluated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_idea_evaluations", x => new { x.idea_id, x.evaluator_user_id, x.criterion });
                });

            migrationBuilder.CreateIndex(
                name: "ix_idea_evaluations_evaluator",
                schema: "public",
                table: "idea_evaluations",
                column: "evaluator_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_idea_evaluations_idea_criterion",
                schema: "public",
                table: "idea_evaluations",
                columns: new[] { "idea_id", "criterion" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "idea_evaluations",
                schema: "public");
        }
    }
}
