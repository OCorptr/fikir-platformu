using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class IdeaSubmissionAndModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "public",
                table: "ideas",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE public.ideas SET updated_at = COALESCE(submitted_at, created_at);");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "updated_at",
                schema: "public",
                table: "ideas",
                type: "timestamp with time zone",
                nullable: false,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "blocked_terms",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    term = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    normalized_term = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    action = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_blocked_terms", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ideas_category_id",
                schema: "public",
                table: "ideas",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ux_blocked_terms_normalized_term",
                schema: "public",
                table: "blocked_terms",
                column: "normalized_term",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ideas_idea_categories_category_id",
                schema: "public",
                table: "ideas",
                column: "category_id",
                principalSchema: "public",
                principalTable: "idea_categories",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ideas_provinces_province_id",
                schema: "public",
                table: "ideas",
                column: "province_id",
                principalSchema: "public",
                principalTable: "provinces",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ideas_student_profiles_student_id",
                schema: "public",
                table: "ideas",
                column: "student_id",
                principalSchema: "public",
                principalTable: "student_profiles",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ideas_idea_categories_category_id",
                schema: "public",
                table: "ideas");

            migrationBuilder.DropForeignKey(
                name: "FK_ideas_provinces_province_id",
                schema: "public",
                table: "ideas");

            migrationBuilder.DropForeignKey(
                name: "FK_ideas_student_profiles_student_id",
                schema: "public",
                table: "ideas");

            migrationBuilder.DropTable(
                name: "blocked_terms",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_ideas_category_id",
                schema: "public",
                table: "ideas");

            migrationBuilder.DropColumn(
                name: "updated_at",
                schema: "public",
                table: "ideas");
        }
    }
}
