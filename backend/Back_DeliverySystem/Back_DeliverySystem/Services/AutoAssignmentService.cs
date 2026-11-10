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

            // A finished/in-transit shipment cannot be automatically reoffered.
            if (shipment.Status is not ("pending_pickup" or "pickup_failed"))
            {
                await transaction.RollbackAsync(cancellationToken);
                return new AutoAssignmentResult(
                    false, "Trạng thái đơn hàng không cho phép phân công tự động.");
            }

            var dispatchMode = ServiceDispatchPolicy.ForService(shipment.Service);

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

            // Rejecting an offer excludes that Staff from future automatic
            // retries for the SAME shipment, preventing an infinite reject loop.
            var rejectedStaffIds = await _db.DeliveryAssignments
                .AsNoTracking()
                .Where(x => x.ShipmentId == shipment.Id && x.Status == "rejected")
                .Select(x => x.StaffId)
                .Distinct()
                .ToListAsync(cancellationToken);

            if (dispatchMode == ServiceDispatchPolicy.GpsOnDemand)
            {
                var decision = await ChooseOnDemandAsync(
                    shipment, rejectedStaffIds, cancellationToken);

                if (decision == null)
                {
                    var reason = "Đơn hỏa tốc đang chờ Staff phù hợp gần nơi lấy hàng hoặc Operations điều phối thủ công.";
                    await AddEventIfChangedAsync(
                        shipment.Id, "waiting_assignment", reason, cancellationToken);
                    await _db.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    return new AutoAssignmentResult(false, reason, AreaId: areaId);
                }

                _db.DeliveryAssignments.Add(new DeliveryAssignment
                {
                    ShipmentId = shipment.Id,
                    StaffId = decision.StaffId,
                    AssignedByUserId = null,
                    AssignmentSource = "auto",
                    AssignedAt = DateTime.UtcNow,
                    Status = "assigned",
                    IsActive = true
                });
                _db.ShipmentEvents.Add(new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "assigned_staff",
                    At = DateTime.UtcNow,
                    Note = decision.Note
                });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return new AutoAssignmentResult(
                    true, decision.Note, decision.StaffId, areaId,
                    decision.ActiveOrders + 1, decision.Capacity);
            }

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
                    $"[{(dispatchMode == ServiceDispatchPolicy.PriorityArea ? "Giao nhanh - ưu tiên khu vực" : "Tiêu chuẩn - theo khu vực/tuyến")}] " +
                    $"Hệ thống tự động phân công {candidate.StaffArea.Staff.EmployeeCode} " +
                    $"cho khu vực {area.Name} " +
                    $"({candidate.ActiveOrders + 1}/{candidate.StaffArea.MaxActiveOrders} đơn)."
            });

            await _db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new AutoAssignmentResult(
                true,
                dispatchMode == ServiceDispatchPolicy.PriorityArea
                    ? "Giao nhanh: phân công theo khu vực và tải hiện tại (chưa tối ưu SLA/tuyến)."
                    : "Tiêu chuẩn: phân công theo khu vực và tải hiện tại (có thể gom vào tuyến).",
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

    private sealed record DispatchChoice(
        int StaffId, int ActiveOrders, int Capacity, string Note);

    private async Task<DispatchChoice?> ChooseOnDemandAsync(
        Shipment shipment,
        IReadOnlyCollection<int> rejectedStaffIds,
        CancellationToken cancellationToken)
    {
        // A Staff can serve multiple wards for express. Capacity is the
        // maximum configured across active areas; do not invent an unlimited
        // capacity for Staff who have never been configured by Operations.
        var configured = await _db.StaffAreas
            .AsNoTracking()
            .Include(x => x.Staff)
            .Where(x => x.IsActive && x.Staff.IsAvailable &&
                        x.Staff.Status != "inactive" &&
                        !rejectedStaffIds.Contains(x.StaffId))
            .ToListAsync(cancellationToken);

        var staffConfigs = configured
            .GroupBy(x => x.StaffId)
            .Select(group => new
            {
                Staff = group.First().Staff,
                Capacity = group.Max(x => x.MaxActiveOrders),
                ServesPickupArea = shipment.PickupAreaId.HasValue &&
                    group.Any(x => x.AreaId == shipment.PickupAreaId.Value)
            })
            .ToList();

        if (staffConfigs.Count == 0) return null;

        // All active jobs count toward express capacity regardless of area.
        var activeCounts = await _db.DeliveryAssignments.AsNoTracking()
            .Where(x => x.IsActive)
            .GroupBy(x => x.StaffId)
            .Select(g => new { StaffId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StaffId, x => x.Count, cancellationToken);

        var eligible = staffConfigs
            .Select(x => new
            {
                x.Staff,
                x.Capacity,
                x.ServesPickupArea,
                ActiveOrders = activeCounts.GetValueOrDefault(x.Staff.Id)
            })
            .Where(x => x.Capacity > 0 && x.ActiveOrders < x.Capacity)
            .ToList();

        if (eligible.Count == 0) return null;

        // StaffLocation exists only while Staff actively shares GPS for a
        // current job. Never fabricate location for an idle Staff.
        if (ServiceDispatchPolicy.HasPickupCoordinates(shipment))
        {
            var now = DateTime.UtcNow;
            var positions = await _db.StaffLocations.AsNoTracking()
                .Where(x => x.UpdatedAt >= now - ServiceDispatchPolicy.MaxGpsAge)
                .ToListAsync(cancellationToken);
            var positionByStaff = positions
                .Where(x => ServiceDispatchPolicy.IsFreshEnough(x, now))
                .ToDictionary(x => x.StaffId, x => x);

            var nearest = eligible
                .Where(x => positionByStaff.ContainsKey(x.Staff.Id))
                .Select(x => new
                {
                    Candidate = x,
                    Km = ServiceDispatchPolicy.DirectDistanceKm(
                        positionByStaff[x.Staff.Id].Latitude,
                        positionByStaff[x.Staff.Id].Longitude,
                        shipment.PickupLatitude!.Value,
                        shipment.PickupLongitude!.Value)
                })
                .Where(x => x.Km <= ServiceDispatchPolicy.MaxPickupDistanceKm)
                .OrderBy(x => x.Km)
                .ThenBy(x => x.Candidate.ActiveOrders)
                .ThenBy(x => x.Candidate.Staff.Id)
                .FirstOrDefault();

            if (nearest != null)
                return new DispatchChoice(
                    nearest.Candidate.Staff.Id,
                    nearest.Candidate.ActiveOrders,
                    nearest.Candidate.Capacity,
                    $"[Hỏa tốc - GPS] Ưu tiên {nearest.Candidate.Staff.EmployeeCode} " +
                    $"cách điểm lấy hàng ~{nearest.Km:F1} km (đường chim bay), " +
                    $"tải {nearest.Candidate.ActiveOrders + 1}/{nearest.Candidate.Capacity}. " +
                    "Staff cần nhận yêu cầu trên Web/Mobile.");
        }

        // Explicit fallback: no eligible nearby LIVE GPS. Prefer Staff assigned
        // to the PICKUP ward, not the delivery ward; this is a policy fallback,
        // not a claim about actual GPS proximity.
        var fallback = eligible
            .Where(x => x.ServesPickupArea)
            .OrderBy(x => (double)x.ActiveOrders / x.Capacity)
            .ThenBy(x => x.ActiveOrders)
            .ThenBy(x => x.Staff.Id)
            .FirstOrDefault();

        if (fallback == null) return null;

        return new DispatchChoice(
            fallback.Staff.Id, fallback.ActiveOrders, fallback.Capacity,
            $"[Hỏa tốc - dự phòng khu vực lấy hàng] Chưa có GPS phù hợp, " +
            $"tạm đề xuất {fallback.Staff.EmployeeCode} theo khu vực lấy hàng; " +
            "cần Staff xác nhận nhận đơn.");
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
