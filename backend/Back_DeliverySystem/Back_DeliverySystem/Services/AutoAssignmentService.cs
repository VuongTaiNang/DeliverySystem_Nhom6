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

            // Giữ cùng rule với manual assignment:
            // shop_prepaid phải thanh toán thành công trước khi phân Staff.
            if (shipment.FeePayer == "shop_prepaid")
            {
                var hasPaid = await _db.Payments.AnyAsync(
                    x =>
                        x.ShipmentId == shipment.Id &&
                        x.Status == "paid",
                    cancellationToken
                );

                if (!hasPaid)
                {
                    var reason =
                        "Đơn shop_prepaid đang chờ thanh toán trước khi phân công Staff.";

                    await AddEventIfChangedAsync(
                        shipment.Id,
                        "waiting_payment",
                        reason,
                        cancellationToken
                    );

                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);

                    return new AutoAssignmentResult(
                        false,
                        reason,
                        AreaId: areaId
                    );
                }
            }

            // Loại Staff đã từ chối chính Shipment này khỏi các lần phân công
            // tự động tiếp theo, tránh phân công lặp lại cho cùng một người.
            var rejectedStaffIds = await _db.DeliveryAssignments
                .AsNoTracking()
                .Where(x => x.ShipmentId == shipment.Id && x.Status == "rejected")
                .Select(x => x.StaffId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var staffAreas = await _db.StaffAreas
                .Include(x => x.Staff)
                .Where(x =>
                    x.AreaId == areaId &&
                    x.IsActive &&
                    !rejectedStaffIds.Contains(x.StaffId) &&
                    x.Staff.IsAvailable &&
                    x.Staff.Status != "inactive"
                )
                .ToListAsync(cancellationToken);

            if (staffAreas.Count == 0)
            {
                var reason =
                    $"Chưa có Staff khả dụng phụ trách {area.Name}.";

                await AddEventIfChangedAsync(
                    shipment.Id,
                    "waiting_assignment",
                    reason,
                    cancellationToken
                );

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return new AutoAssignmentResult(
                    false,
                    reason,
                    AreaId: areaId
                );
            }

            var activeCounts = await (
                    from existingAssignment in _db.DeliveryAssignments
                    join assignedShipment in _db.Shipments
                        on existingAssignment.ShipmentId equals assignedShipment.Id
                    where existingAssignment.IsActive &&
                          assignedShipment.DeliveryAreaId == areaId
                    group existingAssignment by existingAssignment.StaffId
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

            var candidates = staffAreas
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
                .ToList();

            var candidate = candidates
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
                var totalActiveOrders = candidates.Sum(x => x.ActiveOrders);
                var totalCapacity = candidates.Sum(x => x.StaffArea.MaxActiveOrders);
                var reason =
                    $"Tất cả Staff tại {area.Name} đã đạt giới hạn đơn đang xử lý.";

                await AddEventIfChangedAsync(
                    shipment.Id,
                    "waiting_assignment",
                    reason,
                    cancellationToken
                );

                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return new AutoAssignmentResult(
                    false,
                    reason,
                    AreaId: areaId,
                    ActiveOrders: totalActiveOrders,
                    Capacity: totalCapacity
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
                Status = "assigned_staff",
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

    private async Task AddEventIfChangedAsync(
        string shipmentId,
        string status,
        string note,
        CancellationToken cancellationToken)
    {
        var latestEvent = await _db.ShipmentEvents
            .AsNoTracking()
            .Where(x => x.ShipmentId == shipmentId)
            .OrderByDescending(x => x.At)
            .Select(x => new
            {
                x.Status,
                x.Note
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (latestEvent?.Status == status &&
            latestEvent.Note == note)
        {
            return;
        }

        _db.ShipmentEvents.Add(new ShipmentEvent
        {
            ShipmentId = shipmentId,
            Status = status,
            At = DateTime.UtcNow,
            Note = note
        });
    }
}
