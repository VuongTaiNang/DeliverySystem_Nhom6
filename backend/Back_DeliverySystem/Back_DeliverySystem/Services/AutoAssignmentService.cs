using System.Data;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.Models;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Services;

public interface IAutoAssignmentService
{
    Task<AutoAssignmentResult> TryAssignAsync(
        string shipmentId,
        CancellationToken cancellationToken = default
    );
}

public sealed record AutoAssignmentResult(
    bool Assigned,
    string Reason,
    int? StaffId = null,
    int? AreaId = null,
    int ActiveOrders = 0,
    int Capacity = 0
);

public sealed class AutoAssignmentService : IAutoAssignmentService
{
    private readonly AppDbContext _db;

    public AutoAssignmentService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AutoAssignmentResult> TryAssignAsync(
        string shipmentId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(shipmentId))
        {
            return new AutoAssignmentResult(
                false,
                "ShipmentId không hợp lệ."
            );
        }

        await using var transaction =
            await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable,
                cancellationToken
            );

        try
        {
            var shipment = await _db.Shipments
                .FirstOrDefaultAsync(
                    x => x.Id == shipmentId,
                    cancellationToken
                );

            if (shipment == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false,
                    "Không tìm thấy đơn hàng."
                );
            }

            if (shipment.DeliveryAreaId == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false,
                    "Đơn hàng chưa có khu vực giao hàng chuẩn hóa."
                );
            }

            var areaId = shipment.DeliveryAreaId.Value;

            var area = await _db.Areas
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == areaId && x.IsActive,
                    cancellationToken
                );

            if (area == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false,
                    "Khu vực giao hàng không tồn tại hoặc đã ngừng hoạt động.",
                    AreaId: areaId
                );
            }

            var alreadyAssigned = await _db.DeliveryAssignments
                .AnyAsync(
                    x => x.ShipmentId == shipmentId && x.IsActive,
                    cancellationToken
                );

            if (alreadyAssigned)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false,
                    "Đơn hàng đã có nhân viên đang phụ trách.",
                    AreaId: areaId
                );
            }

            var staffAreas = await _db.StaffAreas
                .Include(x => x.Staff)
                .Where(x =>
                    x.AreaId == areaId &&
                    x.IsActive &&
                    x.Staff.IsAvailable &&
                    x.Staff.Status != "inactive"
                )
                .ToListAsync(cancellationToken);

            if (staffAreas.Count == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false,
                    $"Chưa có Staff khả dụng phụ trách {area.Name}.",
                    AreaId: areaId
                );
            }

            var activeCounts = await (
                    from assignment in _db.DeliveryAssignments
                    join assignedShipment in _db.Shipments
                        on assignment.ShipmentId equals assignedShipment.Id
                    where assignment.IsActive &&
                          assignedShipment.DeliveryAreaId == areaId
                    group assignment by assignment.StaffId
                    into grouped
                    select new
                    {
                        StaffId = grouped.Key,
                        Count = grouped.Count()
                    }
                )
                .ToDictionaryAsync(
                    x => x.StaffId,
                    x => x.Count,
                    cancellationToken
                );

            var candidate = staffAreas
                .Select(x => new
                {
                    StaffArea = x,
                    ActiveOrders = activeCounts.TryGetValue(
                        x.StaffId,
                        out var count
                    )
                        ? count
                        : 0
                })
                .Where(x =>
                    x.StaffArea.MaxActiveOrders > 0 &&
                    x.ActiveOrders < x.StaffArea.MaxActiveOrders
                )
                .OrderBy(x =>
                    (double)x.ActiveOrders /
                    x.StaffArea.MaxActiveOrders
                )
                .ThenBy(x => x.ActiveOrders)
                .ThenBy(x => x.StaffArea.StaffId)
                .FirstOrDefault();

            if (candidate == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false,
                    $"Tất cả Staff tại {area.Name} đã đạt giới hạn đơn đang xử lý.",
                    AreaId: areaId
                );
            }

            var assignment = new DeliveryAssignment
            {
                ShipmentId = shipment.Id,
                StaffId = candidate.StaffArea.StaffId,
                AssignedByUserId = null,
                AssignmentSource = "auto",
                AssignedAt = DateTime.UtcNow,
                Status = "assigned",
                IsActive = true
            };

            _db.DeliveryAssignments.Add(assignment);

            _db.ShipmentEvents.Add(new ShipmentEvent
            {
                ShipmentId = shipment.Id,
                Status = shipment.Status,
                At = DateTime.UtcNow,
                Note =
                    $"Hệ thống tự động phân công {candidate.StaffArea.Staff.EmployeeCode} " +
                    $"cho khu vực {area.Name} " +
                    $"({candidate.ActiveOrders + 1}/{candidate.StaffArea.MaxActiveOrders} đơn)."
            });

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new AutoAssignmentResult(
                true,
                "Đã tự động phân công Staff theo khu vực và tải hiện tại.",
                candidate.StaffArea.StaffId,
                areaId,
                candidate.ActiveOrders + 1,
                candidate.StaffArea.MaxActiveOrders
            );
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
