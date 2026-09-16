using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "ideas",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    province_id = table.Column<int>(type: "integer", nullable: false),
                    category_id = table.Column<int>(type: "integer", nullable: false),
                    content = table.Column<string>(type: "character varying(1500)", maxLength: 1500, nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ideas", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ideas_province_status",
                schema: "public",
                table: "ideas",
                columns: new[] { "province_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_ideas_student_id",
                schema: "public",
                table: "ideas",
                column: "student_id");

            migrationBuilder.CreateIndex(
                name: "ix_ideas_submitted_at",
                schema: "public",
                table: "ideas",
                column: "submitted_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ideas",
                schema: "public");
        }
    }
}
