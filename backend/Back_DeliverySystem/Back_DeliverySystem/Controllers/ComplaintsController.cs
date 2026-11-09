using System.Security.Claims;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs.Customer;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class ComplaintsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ComplaintsController(AppDbContext db) => _db = db;

    private int? CurrentUserId() =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    // Customer: danh sách khiếu nại của chính mình (mọi đơn)
    // GET /api/v1/complaints/mine
    [HttpGet("complaints/mine")]
    [Authorize(Roles = "customer")]
    public async Task<IActionResult> Mine()
    {
        var uid = CurrentUserId();
        if (uid == null) return Unauthorized(new { message = "Vui lòng đăng nhập." });

        var items = await _db.Complaints.AsNoTracking()
            .Where(x => x.CustomerId == uid && x.Source == "customer")
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id, x.ShipmentId, x.Source, x.Type, x.Category, x.Content,
                x.Status, x.Response, x.CreatedAt, x.ResolvedAt
            })
            .ToListAsync();
        return Ok(items);
    }

    // Lịch sử giải quyết
    // GET /api/v1/complaints/{id}/history
    [HttpGet("complaints/{id:int}/history")]
    [Authorize(Roles = "customer,staff,operations")]
    public async Task<IActionResult> History(int id)
    {
        var uid = CurrentUserId();
        var c = await _db.Complaints.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFound(new { message = "Không tìm thấy khiếu nại." });

        var allowed =
            User.IsInRole("operations") ||
            (User.IsInRole("customer") && c.Source == "customer" && c.CustomerId == uid) ||
            (User.IsInRole("staff") && c.Source == "staff" && c.ReportedByUserId == uid);
        if (!allowed) return Forbid();

        var history = await _db.ComplaintHistories.AsNoTracking()
            .Where(h => h.ComplaintId == id)
            .OrderBy(h => h.CreatedAt).ThenBy(h => h.Id)
            .Select(h => new
            {
                h.Id, h.Action, h.FromStatus, h.ToStatus, h.Note, h.ActorRole, h.CreatedAt
            })
            .ToListAsync();
        return Ok(history);
    }

    // Operations: phân loại
    // PATCH /api/v1/complaints/{id}/classify
    [HttpPatch("complaints/{id:int}/classify")]
    [Authorize(Roles = "operations")]
    public async Task<IActionResult> Classify(int id, [FromBody] ClassifyComplaintRequest request)
    {
        var c = await _db.Complaints.FirstOrDefaultAsync(x => x.Id == id);
        if (c == null) return NotFound(new { message = "Không tìm thấy khiếu nại." });

        var category = request.Category.Trim().ToLowerInvariant();
        if (!ComplaintRules.Categories.Contains(category))
            return BadRequest(new { message = "Phân loại không hợp lệ." });
        if (c.Status == "resolved")
            return Conflict(new { message = "Khiếu nại đã giải quyết, không thể đổi phân loại." });

        var old = c.Category;
        c.Category = category;
        c.UpdatedAt = DateTime.UtcNow;
        c.HandledByUserId = CurrentUserId();

        _db.ComplaintHistories.Add(new ComplaintHistory
        {
            ComplaintId = c.Id,
            Action = "classified",
            FromStatus = c.Status,
            ToStatus = c.Status,
            Note = $"Phân loại: {old ?? "chưa phân loại"} → {category}",
            ActorUserId = CurrentUserId(),
            ActorRole = "operations",
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        return Ok(new { c.Id, c.Category, c.Status, c.UpdatedAt });
    }
}