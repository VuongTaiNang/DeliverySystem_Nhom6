using System;
using Back_DeliverySystem.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Back_DeliverySystem.Migrations;

/// <summary>Stores only the latest opt-in GPS position for each Staff member.</summary>
[DbContext(typeof(AppDbContext))]
[Migration("20261107123000_AddStaffLocationTracking")]
public partial class AddStaffLocationTracking : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "StaffLocations",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                StaffId = table.Column<int>(type: "int", nullable: false),
                AssignmentId = table.Column<int>(type: "int", nullable: false),
                ShipmentId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                Latitude = table.Column<double>(type: "float", nullable: false),
                Longitude = table.Column<double>(type: "float", nullable: false),
                AccuracyMeters = table.Column<double>(type: "float", nullable: true),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_StaffLocations", x => x.Id);
                table.ForeignKey("FK_StaffLocations_DeliveryAssignments_AssignmentId", x => x.AssignmentId, "DeliveryAssignments", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_StaffLocations_Shipments_ShipmentId", x => x.ShipmentId, "Shipments", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_StaffLocations_Staffs_StaffId", x => x.StaffId, "Staffs", "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_StaffLocations_AssignmentId", table: "StaffLocations", column: "AssignmentId");
        migrationBuilder.CreateIndex(name: "IX_StaffLocations_ShipmentId", table: "StaffLocations", column: "ShipmentId");
        migrationBuilder.CreateIndex(name: "IX_StaffLocations_StaffId", table: "StaffLocations", column: "StaffId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_StaffLocations_UpdatedAt", table: "StaffLocations", column: "UpdatedAt");
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "StaffLocations");
}
