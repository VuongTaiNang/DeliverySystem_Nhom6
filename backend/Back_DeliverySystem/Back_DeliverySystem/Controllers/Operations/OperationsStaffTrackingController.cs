using Back_DeliverySystem.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers;

[ApiController]
[Route("api/v1/operations/staff-tracking")]
[Authorize(Roles = "operations")]
public class OperationsStaffTrackingController : ControllerBase
{
    private readonly AppDbContext _db;
    private const double EtaSpeedKmPerHour = 25;
    public OperationsStaffTrackingController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var rows = await (
            from location in _db.StaffLocations.AsNoTracking()
            join staff in _db.Staffs.AsNoTracking() on location.StaffId equals staff.Id
            join user in _db.Users.AsNoTracking() on staff.UserId equals user.Id
            join assignment in _db.DeliveryAssignments.AsNoTracking() on location.AssignmentId equals assignment.Id
            join shipment in _db.Shipments.AsNoTracking() on location.ShipmentId equals shipment.Id
            orderby location.UpdatedAt descending
            select new { location, staff, user, assignment, shipment }
        ).ToListAsync();

        var now = DateTime.UtcNow;
        var result = rows.Select(row =>
        {
            var pickup = IsPickupStage(row.shipment.Status);
            var targetLatitude = pickup ? row.shipment.PickupLatitude : row.shipment.DeliveryLatitude;
            var targetLongitude = pickup ? row.shipment.PickupLongitude : row.shipment.DeliveryLongitude;
            var distanceKm = targetLatitude.HasValue && targetLongitude.HasValue
                ? HaversineKm(row.location.Latitude, row.location.Longitude, targetLatitude.Value, targetLongitude.Value)
                : (double?)null;
            var etaMinutes = distanceKm.HasValue ? Math.Max(1, (int)Math.Ceiling(distanceKm.Value / EtaSpeedKmPerHour * 60)) : (int?)null;
            return new
            {
                staffId = row.staff.Id,
                row.staff.EmployeeCode,
                staffName = row.user.FullName,
                row.staff.Status,
                row.location.AssignmentId,
                row.location.ShipmentId,
                latitude = row.location.Latitude,
                longitude = row.location.Longitude,
                row.location.AccuracyMeters,
                row.location.UpdatedAt,
                isStale = row.location.UpdatedAt < now.AddMinutes(-5),
                isAssignmentActive = row.assignment.IsActive && row.assignment.Status == "accepted",
                shipmentStatus = row.shipment.Status,
                targetType = pickup ? "pickup" : "delivery",
                targetAddress = pickup ? row.shipment.PickupAddress : row.shipment.DeliveryAddress,
                targetLatitude = targetLatitude.HasValue ? Math.Round(targetLatitude.Value, 7) : (double?)null,
                targetLongitude = targetLongitude.HasValue ? Math.Round(targetLongitude.Value, 7) : (double?)null,
                distanceKm = distanceKm.HasValue ? Math.Round(distanceKm.Value, 2) : (double?)null,
                etaMinutes,
                etaAssumption = etaMinutes.HasValue ? "Ước tính theo đường chim bay với tốc độ 25 km/h" : null
            };
        });
        return Ok(result);
    }

    private static bool IsPickupStage(string status) => status is "pending_pickup" or "picking_up" or "pickup_failed";
    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double radius = 6371;
        static double Radians(double value) => value * Math.PI / 180;
        var dLat = Radians(lat2 - lat1); var dLon = Radians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return radius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}
