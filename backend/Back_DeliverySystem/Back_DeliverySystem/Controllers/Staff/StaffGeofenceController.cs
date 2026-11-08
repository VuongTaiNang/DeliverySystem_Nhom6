using System.Data;
using System.Security.Claims;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers;

[ApiController]
[Route("api/v1/staff/assignments/{assignmentId:int}/geofence-arrivals")]
[Authorize(Roles = "staff")]
public sealed class StaffGeofenceController : ControllerBase
{
    private const double GeofenceRadiusMeters = 150;
    private const double MaxGpsAccuracyMeters = 100;
    private readonly AppDbContext _db;

    public StaffGeofenceController(AppDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<IActionResult> RecordArrival(
        int assignmentId,
        [FromBody] GeofenceArrivalRequest request,
        CancellationToken cancellationToken)
    {
        if (assignmentId <= 0 ||
            !double.IsFinite(request.Latitude) ||
            !double.IsFinite(request.Longitude) ||
            request.Latitude is < -90 or > 90 ||
            request.Longitude is < -180 or > 180 ||
            !double.IsFinite(request.Accuracy) ||
            request.Accuracy <= 0 ||
            request.Accuracy > MaxGpsAccuracyMeters)
        {
            return BadRequest(new
            {
                message = "Tọa độ hoặc độ chính xác GPS không hợp lệ."
            });
        }

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdValue, out var userId))
        {
            return Unauthorized(new { message = "Không xác định được tài khoản Staff." });
        }

        var staff = await _db.Staffs.FirstOrDefaultAsync(
            x => x.UserId == userId,
            cancellationToken);
        if (staff == null)
        {
            return Unauthorized(new { message = "Không tìm thấy hồ sơ nhân viên." });
        }

        var stage = request.Stage?.Trim().ToLowerInvariant();
        if (stage is not ("pickup" or "delivery"))
        {
            return BadRequest(new { message = "Giai đoạn Geofence không hợp lệ." });
        }

        // Serializable + duplicate check bảo vệ trường hợp nhiều GPS callback
        // gửi cùng một sự kiện gần như đồng thời.
        await using var transaction = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        var assignment = await _db.DeliveryAssignments.FirstOrDefaultAsync(
            x => x.Id == assignmentId &&
                 x.StaffId == staff.Id &&
                 x.IsActive,
            cancellationToken);
        if (assignment == null)
        {
            return NotFound(new { message = "Không tìm thấy phân công đang hoạt động của Staff." });
        }

        var shipment = await _db.Shipments.FirstOrDefaultAsync(
            x => x.Id == assignment.ShipmentId,
            cancellationToken);
        if (shipment == null)
        {
            return NotFound(new { message = "Không tìm thấy Shipment." });
        }

        double? targetLatitude;
        double? targetLongitude;
        string eventStatus;
        string placeLabel;
        string expectedShipmentStatus;

        if (stage == "pickup")
        {
            targetLatitude = shipment.PickupLatitude;
            targetLongitude = shipment.PickupLongitude;
            eventStatus = "arrived_at_pickup";
            placeLabel = "điểm lấy hàng";
            expectedShipmentStatus = "picking_up";
        }
        else
        {
            targetLatitude = shipment.DeliveryLatitude;
            targetLongitude = shipment.DeliveryLongitude;
            eventStatus = "arrived_at_delivery";
            placeLabel = "điểm giao hàng";
            expectedShipmentStatus = "delivering";
        }

        if (!targetLatitude.HasValue || !targetLongitude.HasValue ||
            !double.IsFinite(targetLatitude.Value) ||
            !double.IsFinite(targetLongitude.Value) ||
            targetLatitude is < -90 or > 90 ||
            targetLongitude is < -180 or > 180 ||
            (targetLatitude == 0 && targetLongitude == 0))
        {
            return BadRequest(new
            {
                message = $"Shipment chưa có tọa độ hợp lệ cho {placeLabel}."
            });
        }

        if (!string.Equals(shipment.Status, expectedShipmentStatus, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(assignment.Status, "in_progress", StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new
            {
                message = $"Staff chưa ở đúng giai đoạn công việc để ghi nhận đến {placeLabel}."
            });
        }

        var distanceMeters = DistanceMeters(
            request.Latitude,
            request.Longitude,
            targetLatitude.Value,
            targetLongitude.Value);

        if (distanceMeters > GeofenceRadiusMeters)
        {
            return BadRequest(new
            {
                message = "Staff vẫn ở ngoài vùng Geofence.",
                distanceMeters = Math.Round(distanceMeters, 1),
                radiusMeters = GeofenceRadiusMeters
            });
        }

        var alreadyRecorded = await _db.ShipmentEvents.AnyAsync(
            x => x.ShipmentId == shipment.Id && x.Status == eventStatus,
            cancellationToken);

        if (alreadyRecorded)
        {
            await transaction.CommitAsync(cancellationToken);
            return Ok(new
            {
                message = "Sự kiện Staff đến điểm đã được ghi nhận trước đó.",
                alreadyRecorded = true,
                eventStatus
            });
        }

        var recordedAt = DateTime.UtcNow;
        _db.ShipmentEvents.Add(new ShipmentEvent
        {
            ShipmentId = shipment.Id,
            Status = eventStatus,
            At = recordedAt,
            Note = $"Staff {staff.EmployeeCode} đã đến {placeLabel}. " +
                   $"Khoảng cách GPS: {Math.Round(distanceMeters, 1)} m; " +
                   $"độ chính xác: {Math.Round(request.Accuracy, 1)} m."
        });

        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // Arrival chỉ là sự kiện lịch sử; tuyệt đối không đổi Shipment.Status.
        return Ok(new
        {
            message = $"Đã ghi nhận Staff đến {placeLabel}.",
            alreadyRecorded = false,
            eventStatus,
            recordedAt,
            distanceMeters = Math.Round(distanceMeters, 1),
            radiusMeters = GeofenceRadiusMeters
        });
    }

    private static double DistanceMeters(
        double latitude1,
        double longitude1,
        double latitude2,
        double longitude2)
    {
        const double earthRadiusMeters = 6371000;
        static double ToRadians(double degrees) => degrees * Math.PI / 180;

        var dLatitude = ToRadians(latitude2 - latitude1);
        var dLongitude = ToRadians(longitude2 - longitude1);
        var a = Math.Pow(Math.Sin(dLatitude / 2), 2) +
                Math.Cos(ToRadians(latitude1)) *
                Math.Cos(ToRadians(latitude2)) *
                Math.Pow(Math.Sin(dLongitude / 2), 2);
        return earthRadiusMeters * 2 *
               Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }
}

public sealed class GeofenceArrivalRequest
{
    public string Stage { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double Accuracy { get; set; }
}
