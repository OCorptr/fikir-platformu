using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProvinceUserAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "province_user_assignments",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    province_id = table.Column<int>(type: "integer", nullable: false),
                    role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    assigned_by_user_id = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_province_user_assignments", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_province_user_province",
                schema: "public",
                table: "province_user_assignments",
                column: "province_id");

            migrationBuilder.CreateIndex(
                name: "ux_province_user_one_manager",
                schema: "public",
                table: "province_user_assignments",
                columns: new[] { "province_id", "role" },
                unique: true,
                filter: "role = 'ProvinceManager'");

            migrationBuilder.CreateIndex(
                name: "ux_province_user_user_role",
                schema: "public",
                table: "province_user_assignments",
                columns: new[] { "user_id", "role" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "province_user_assignments",
                schema: "public");
        }
    }
}
