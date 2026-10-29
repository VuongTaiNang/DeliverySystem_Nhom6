using System.ComponentModel.DataAnnotations;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.Models;
using Back_DeliverySystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers.Operations;

[ApiController]
[Route("api/v1/operations/areas")]
[Authorize(Roles = "operations")]
public class OperationsAreasController : ControllerBase
{
    private static readonly HashSet<string> AllowedTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "ward",
            "commune",
            "special_zone"
        };

    private readonly AppDbContext _db;
    private readonly IAutoAssignmentService _autoAssignment;

    public OperationsAreasController(
        AppDbContext db,
        IAutoAssignmentService autoAssignment)
    {
        _db = db;
        _autoAssignment = autoAssignment;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        CancellationToken cancellationToken)
    {
        var areas = await _db.Areas
            .AsNoTracking()
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.Type)
            .ThenBy(x => x.Name)
            .ToListAsync(cancellationToken);

        var staffAreas = await _db.StaffAreas
            .AsNoTracking()
            .Include(x => x.Staff)
            .ToListAsync(cancellationToken);

        var activeCounts = await (
                from assignment in _db.DeliveryAssignments.AsNoTracking()
                join shipment in _db.Shipments.AsNoTracking()
                    on assignment.ShipmentId equals shipment.Id
                where assignment.IsActive &&
                      shipment.DeliveryAreaId != null
                group assignment by new
                {
                    assignment.StaffId,
                    AreaId = shipment.DeliveryAreaId!.Value
                }
                into grouped
                select new
                {
                    grouped.Key.StaffId,
                    grouped.Key.AreaId,
                    Count = grouped.Count()
                }
            )
            .ToListAsync(cancellationToken);

        var countLookup = activeCounts.ToDictionary(
            x => (x.StaffId, x.AreaId),
            x => x.Count
        );

        var result = areas.Select(area =>
        {
            var assignments = staffAreas
                .Where(x => x.AreaId == area.Id)
                .OrderBy(x => x.Staff.EmployeeCode)
                .Select(x =>
                {
                    var activeOrders = countLookup.TryGetValue(
                        (x.StaffId, area.Id),
                        out var count
                    )
                        ? count
                        : 0;

                    var utilization = x.MaxActiveOrders <= 0
                        ? 1d
                        : (double)activeOrders / x.MaxActiveOrders;

                    return new
                    {
                        staffAreaId = x.Id,
                        staffId = x.StaffId,
                        employeeCode = x.Staff.EmployeeCode,
                        staffStatus = x.Staff.Status,
                        staffAvailable = x.Staff.IsAvailable,
                        maxActiveOrders = x.MaxActiveOrders,
                        activeOrders,
                        utilization = Math.Round(utilization, 4),
                        isFull = activeOrders >= x.MaxActiveOrders,
                        isActive = x.IsActive
                    };
                })
                .ToList();

            return new
            {
                id = area.Id,
                code = area.Code,
                name = area.Name,
                type = area.Type,
                isActive = area.IsActive,
                staffCount = assignments.Count(x => x.isActive),
                totalCapacity = assignments
                    .Where(x => x.isActive)
                    .Sum(x => x.maxActiveOrders),
                activeOrders = assignments
                    .Where(x => x.isActive)
                    .Sum(x => x.activeOrders),
                staff = assignments
            };
        });

        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] SaveAreaRequest request,
        CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();
        var type = request.Type.Trim().ToLowerInvariant();

        if (!AllowedTypes.Contains(type))
        {
            return BadRequest(new
            {
                message = "Type chỉ được là ward, commune hoặc special_zone."
            });
        }

        var duplicateCode = await _db.Areas.AnyAsync(
            x => x.Code == code,
            cancellationToken
        );

        if (duplicateCode)
        {
            return Conflict(new
            {
                message = "Mã khu vực đã tồn tại."
            });
        }

        var area = new Area
        {
            Code = code,
            Name = name,
            Type = type,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _db.Areas.Add(area);
        await _db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new
        {
            area.Id,
            area.Code,
            area.Name,
            area.Type,
            area.IsActive
        });
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] SaveAreaRequest request,
        CancellationToken cancellationToken)
    {
        var area = await _db.Areas.FirstOrDefaultAsync(
            x => x.Id == id,
            cancellationToken
        );

        if (area == null)
        {
            return NotFound(new
            {
                message = "Không tìm thấy khu vực."
            });
        }

        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();
        var type = request.Type.Trim().ToLowerInvariant();

        if (!AllowedTypes.Contains(type))
        {
            return BadRequest(new
            {
                message = "Type chỉ được là ward, commune hoặc special_zone."
            });
        }

        var duplicateCode = await _db.Areas.AnyAsync(
            x => x.Id != id && x.Code == code,
            cancellationToken
        );

        if (duplicateCode)
        {
            return Conflict(new
            {
                message = "Mã khu vực đã tồn tại."
            });
        }

        area.Code = code;
        area.Name = name;
        area.Type = type;
        area.IsActive = request.IsActive;

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            area.Id,
            area.Code,
            area.Name,
            area.Type,
            area.IsActive
        });
    }

    [HttpPut("{areaId:int}/staff/{staffId:int}")]
    public async Task<IActionResult> AssignStaff(
        int areaId,
        int staffId,
        [FromBody] SaveStaffAreaRequest request,
        CancellationToken cancellationToken)
    {
        var areaExists = await _db.Areas.AnyAsync(
            x => x.Id == areaId,
            cancellationToken
        );

        if (!areaExists)
        {
            return NotFound(new
            {
                message = "Không tìm thấy khu vực."
            });
        }

        var staffExists = await _db.Staffs.AnyAsync(
            x => x.Id == staffId,
            cancellationToken
        );

        if (!staffExists)
        {
            return NotFound(new
            {
                message = "Không tìm thấy Staff."
            });
        }

        var staffArea = await _db.StaffAreas.FirstOrDefaultAsync(
            x => x.AreaId == areaId && x.StaffId == staffId,
            cancellationToken
        );

        if (staffArea == null)
        {
            staffArea = new StaffArea
            {
                AreaId = areaId,
                StaffId = staffId,
                MaxActiveOrders = request.MaxActiveOrders,
                IsActive = request.IsActive,
                AssignedAt = DateTime.UtcNow
            };

            _db.StaffAreas.Add(staffArea);
        }
        else
        {
            staffArea.MaxActiveOrders = request.MaxActiveOrders;
            staffArea.IsActive = request.IsActive;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            staffArea.Id,
            staffArea.AreaId,
            staffArea.StaffId,
            staffArea.MaxActiveOrders,
            staffArea.IsActive
        });
    }

    [HttpPost("auto-assign/{shipmentId}")]
    public async Task<IActionResult> RetryAutoAssign(
        string shipmentId,
        CancellationToken cancellationToken)
    {
        var result = await _autoAssignment.TryAssignAsync(
            shipmentId,
            cancellationToken
        );

        if (!result.Assigned)
        {
            return Conflict(result);
        }

        return Ok(result);
    }
}

public sealed class SaveAreaRequest
{
    [Required]
    [StringLength(50, MinimumLength = 2)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(150, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string Type { get; set; } = "ward";

    public bool IsActive { get; set; } = true;
}

public sealed class SaveStaffAreaRequest
{
    [Range(1, 100)]
    public int MaxActiveOrders { get; set; } = 10;

    public bool IsActive { get; set; } = true;
}
