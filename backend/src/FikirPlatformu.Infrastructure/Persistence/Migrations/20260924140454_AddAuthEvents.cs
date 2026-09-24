using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FikirPlatformu.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAuthEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "auth_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "utf8mb4_general_ci"),
                    user_id = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    email = table.Column<string>(type: "varchar(256)", maxLength: 256, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ip_address = table.Column<string>(type: "varchar(45)", maxLength: 45, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    user_agent = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    event_type = table.Column<int>(type: "int", nullable: false),
                    success = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    failure_reason = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_auth_events", x => x.id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "ix_auth_events_created_at",
                table: "auth_events",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_auth_events_type_created",
                table: "auth_events",
                columns: new[] { "event_type", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_auth_events_user_id",
                table: "auth_events",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auth_events");
        }
    }
}
