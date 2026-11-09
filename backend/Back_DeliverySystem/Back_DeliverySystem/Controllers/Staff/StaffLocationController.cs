using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Back_DeliverySystem.Controllers;

[ApiController]
[Route("api/v1/staff/location")]
[Authorize(Roles = "staff")]
public class StaffLocationController : ControllerBase
{
    private readonly AppDbContext _db;
    public StaffLocationController(AppDbContext db) => _db = db;

    [HttpPost]
    public async Task<IActionResult> UpdateLocation([FromBody] StaffLocationRequest request)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(claim, out var userId)) return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });

        if (request.AssignmentId <= 0 || !IsCoordinate(request.Latitude, request.Longitude))
            return BadRequest(new { message = "Dữ liệu tọa độ hoặc mã phân công không hợp lệ." });
        if (request.AccuracyMeters is < 0 or > 10000)
            return BadRequest(new { message = "Độ chính xác GPS không hợp lệ." });

        var staff = await _db.Staffs.FirstOrDefaultAsync(x => x.UserId == userId);
        if (staff == null) return Unauthorized(new { message = "Không tìm thấy hồ sơ nhân viên." });

        var assignment = await _db.DeliveryAssignments
            .Join(_db.Shipments, a => a.ShipmentId, s => s.Id, (a, s) => new { a, s })
            .FirstOrDefaultAsync(x => x.a.Id == request.AssignmentId && x.a.StaffId == staff.Id && x.a.IsActive &&
                (x.a.Status == "accepted" || x.a.Status == "in_progress"));
        if (assignment == null)
            return Conflict(new { message = "Chỉ có thể chia sẻ vị trí cho nhiệm vụ đang được bạn thực hiện." });

        var now = DateTime.UtcNow;
        var location = await _db.StaffLocations.FirstOrDefaultAsync(x => x.StaffId == staff.Id);
        if (location == null)
        {
            location = new StaffLocation { StaffId = staff.Id };
            _db.StaffLocations.Add(location);
        }
        location.AssignmentId = assignment.a.Id;
        location.ShipmentId = assignment.s.Id;
        location.Latitude = request.Latitude;
        location.Longitude = request.Longitude;
        location.AccuracyMeters = request.AccuracyMeters;
        location.UpdatedAt = now;
        await _db.SaveChangesAsync();

        return Ok(new { message = "Đã cập nhật vị trí.", latitude = location.Latitude, longitude = location.Longitude, updatedAt = location.UpdatedAt });
    }

    private static bool IsCoordinate(double latitude, double longitude) =>
        double.IsFinite(latitude) && double.IsFinite(longitude) && latitude is >= -90 and <= 90 && longitude is >= -180 and <= 180;
}
