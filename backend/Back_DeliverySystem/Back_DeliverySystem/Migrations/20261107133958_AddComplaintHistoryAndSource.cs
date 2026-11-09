using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back_DeliverySystem.Migrations
{
    /// <inheritdoc />
    public partial class AddComplaintHistoryAndSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Complaints",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<int>(
                name: "AssignmentId",
                table: "Complaints",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Complaints",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HandledByUserId",
                table: "Complaints",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReportedByStaffId",
                table: "Complaints",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReportedByUserId",
                table: "Complaints",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Complaints",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "customer");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Complaints",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ComplaintHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ComplaintId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    ToStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    ActorRole = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComplaintHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ComplaintHistories_Complaints_ComplaintId",
                        column: x => x.ComplaintId,
                        principalTable: "Complaints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Complaints_Source_Status",
                table: "Complaints",
                columns: new[] { "Source", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ComplaintHistories_ComplaintId",
                table: "ComplaintHistories",
                column: "ComplaintId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComplaintHistories");

            migrationBuilder.DropIndex(
                name: "IX_Complaints_Source_Status",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "AssignmentId",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "HandledByUserId",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "ReportedByStaffId",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "ReportedByUserId",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Complaints");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Complaints");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Complaints",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");
        }
    }
}
