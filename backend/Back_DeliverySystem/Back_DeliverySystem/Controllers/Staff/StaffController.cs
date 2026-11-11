using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Back_DeliverySystem.DTOs.Staff;
using Back_DeliverySystem.Services;

namespace Back_DeliverySystem.Controllers
{
    [ApiController]
    [Route("api/v1/staff")]
    [Authorize(Roles = "staff")]
    public class StaffController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAutoAssignmentService _autoAssignment;
        private readonly ILogger<StaffController> _logger;

        private const int MaxDeliveryAttempts = 3;

        public StaffController(
            AppDbContext context,
            IAutoAssignmentService autoAssignment,
            ILogger<StaffController> logger)
        {
            _context = context;
            _autoAssignment = autoAssignment;
            _logger = logger;
        }

        // =====================================================
        // LẤY STAFF ĐANG ĐĂNG NHẬP
        // =====================================================
        private async Task<Staff?> GetCurrentStaffAsync()
        {
            var userIdClaim =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    userIdClaim,
                    out var userId))
            {
                return null;
            }

            return await _context.Staffs
                .FirstOrDefaultAsync(
                    x => x.UserId == userId
                );
        }

        // =====================================================
        // XEM ĐƠN ĐƯỢC PHÂN CÔNG
        // GET: /api/v1/staff/shipments
        // =====================================================
        [HttpGet("shipments")]
        public async Task<IActionResult> GetMyShipments()
        {
            var staff =
                await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var shipments =
                await (
                    from assignment in
                        _context.DeliveryAssignments
                            .AsNoTracking()

                    join shipment in
                        _context.Shipments
                            .AsNoTracking()

                    on assignment.ShipmentId
                        equals shipment.Id

                    where
                        assignment.StaffId ==
                            staff.Id &&
                        assignment.IsActive

                    orderby assignment.AssignedAt

                    select new
                    {
                        assignmentId =
                            assignment.Id,

                        assignmentStatus =
                            assignment.Status,

                        assignedAt =
                            assignment.AssignedAt,

                        acceptedAt =
                            assignment.AcceptedAt,

                        shipmentId =
                            shipment.Id,

                        shipmentStatus =
                            shipment.Status,

                        senderName =
                            shipment.SenderName,

                        senderPhone =
                            shipment.SenderPhone,

                        pickupAddress =
                            shipment.PickupAddress,

                        pickupLatitude =
                            shipment.PickupLatitude,

                        pickupLongitude =
                            shipment.PickupLongitude,

                        recipientName =
                            shipment.RecipientName,

                        recipientPhone =
                            shipment.RecipientPhone,

                        deliveryAddress =
                            shipment.DeliveryAddress,

                        deliveryLatitude =
                            shipment.DeliveryLatitude,

                        deliveryLongitude =
                            shipment.DeliveryLongitude,

                        goods =
                            shipment.Goods,

                        weightKg =
                            shipment.WeightKg,

                        codAmount =
                            shipment.CodAmount,

                        declaredValue =
                            shipment.DeclaredValue,

                        service =
                            shipment.Service,

                        notes =
                            shipment.Notes
                    }
                )
                .ToListAsync();

            return Ok(shipments);
        }

        // =====================================================
        // STAFF ACCEPT ASSIGNMENT
        // PATCH: /api/v1/staff/assignments/{id}/accept
        // =====================================================
        [HttpPatch("assignments/{id:int}/accept")]
        public async Task<IActionResult>
            AcceptAssignment(int id)
        {
            var staff =
                await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment =
                await _context.DeliveryAssignments
                    .FirstOrDefaultAsync(x =>
                        x.Id == id &&
                        x.StaffId == staff.Id
                    );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn được phân công."
                });
            }

            if (!assignment.IsActive)
            {
                return Conflict(new
                {
                    message =
                        "Phân công này không còn hiệu lực."
                });
            }

            if (assignment.Status != "assigned")
            {
                return Conflict(new
                {
                    message =
                        "Đơn này không còn ở trạng thái chờ xác nhận."
                });
            }

            assignment.Status =
                "accepted";

            assignment.AcceptedAt =
                DateTime.UtcNow;

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId =
                        assignment.ShipmentId,

                    Status =
                        "assignment_accepted",

                    At =
                        DateTime.UtcNow,

                    Note =
                        $"Nhân viên {staff.EmployeeCode} đã nhận đơn."
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Nhận đơn thành công.",

                assignment = new
                {
                    id =
                        assignment.Id,

                    shipmentId =
                        assignment.ShipmentId,

                    status =
                        assignment.Status,

                    acceptedAt =
                        assignment.AcceptedAt
                }
            });
        }

        // =====================================================
        // STAFF REJECT ASSIGNMENT
        // PATCH: /api/v1/staff/assignments/{id}/reject
        // =====================================================
        [HttpPatch("assignments/{id:int}/reject")]
        public async Task<IActionResult>
            RejectAssignment(
                int id,
                [FromBody]
                RejectAssignmentRequest request)
        {
            var staff =
                await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment =
                await _context.DeliveryAssignments
                    .FirstOrDefaultAsync(x =>
                        x.Id == id &&
                        x.StaffId == staff.Id
                    );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn được phân công."
                });
            }

            if (!assignment.IsActive)
            {
                return Conflict(new
                {
                    message =
                        "Phân công này không còn hiệu lực."
                });
            }

            if (assignment.Status != "assigned")
            {
                return Conflict(new
                {
                    message =
                        "Đơn này không còn ở trạng thái chờ xác nhận."
                });
            }

            var reason =
                request.Reason?.Trim()
                ?? string.Empty;

            if (string.IsNullOrWhiteSpace(reason))
            {
                return BadRequest(new
                {
                    message =
                        "Vui lòng nhập lý do từ chối."
                });
            }

            if (reason.Length > 300)
            {
                return BadRequest(new
                {
                    message =
                        "Lý do từ chối không được vượt quá 300 ký tự."
                });
            }

            assignment.Status =
                "rejected";

            assignment.IsActive =
                false;

            assignment.EndedAt =
                DateTime.UtcNow;

            assignment.RejectionReason =
                reason;

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId =
                        assignment.ShipmentId,

                    Status =
                        "assignment_rejected",

                    At =
                        DateTime.UtcNow,

                    Note =
                        $"{staff.EmployeeCode} từ chối đơn. Lý do: {reason}"
                }
            );

            await _context.SaveChangesAsync();

            // Ghi nhận từ chối trước, sau đó tự thử phân cho Staff khác.
            // AutoAssignmentService loại Staff đã từ chối chính đơn này.
            // Nếu không còn ứng viên hoặc phát sinh lỗi, đơn vẫn được ghi nhận
            // từ chối và chờ Operations can thiệp.
            AutoAssignmentResult? retry = null;
            try
            {
                retry = await _autoAssignment.TryAssignAsync(assignment.ShipmentId);
            }
            catch (Exception error)
            {
                _logger.LogError(error,
                    "Automatic reassignment failed after Staff rejected assignment {AssignmentId}",
                    assignment.Id);
            }

            return Ok(new
            {
                message = retry?.Assigned == true
                    ? "Đã từ chối; hệ thống đã phân công cho Staff khác."
                    : "Đã từ chối; đơn đang chờ phân công tiếp.",
                reassignment = retry == null ? null : new
                {
                    assigned = retry.Assigned,
                    reason = retry.Reason,
                    staffId = retry.StaffId
                },

                assignment = new
                {
                    id =
                        assignment.Id,

                    shipmentId =
                        assignment.ShipmentId,

                    status =
                        assignment.Status,

                    rejectionReason =
                        assignment.RejectionReason,

                    endedAt =
                        assignment.EndedAt
                }
            });
        }

        // =====================================================
        // STAFF BẮT ĐẦU ĐI LẤY HÀNG
        // PATCH: /api/v1/staff/assignments/{id}/start-pickup
        // =====================================================
        [HttpPatch("assignments/{id:int}/start-pickup")]
        public async Task<IActionResult> StartPickup(int id)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message = "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == id &&
                    x.StaffId == staff.Id
                );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn được phân công."
                });
            }

            if (!assignment.IsActive)
            {
                return Conflict(new
                {
                    message = "Phân công này không còn hiệu lực."
                });
            }

            if (assignment.Status != "accepted")
            {
                return Conflict(new
                {
                    message = "Bạn phải nhận đơn trước khi đi lấy hàng."
                });
            }

            var shipment = await _context.Shipments
                .FirstOrDefaultAsync(
                    x => x.Id == assignment.ShipmentId
                );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "pending_pickup" &&
                shipment.Status != "pickup_failed")
            {
                return Conflict(new
                {
                    message = "Đơn hàng hiện không thể bắt đầu lấy hàng."
                });
            }

            assignment.Status = "in_progress";
            shipment.Status = "picking_up";

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "picking_up",
                    At = DateTime.UtcNow,
                    Note = $"{staff.EmployeeCode} đang đi lấy hàng."
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã bắt đầu đi lấy hàng.",
                shipment = new
                {
                    id = shipment.Id,
                    status = shipment.Status,
                    assignmentStatus = assignment.Status
                }
            });
        }

        // =====================================================
        // LẤY HÀNG THÀNH CÔNG
        // PATCH: /api/v1/staff/assignments/{id}/pickup-success
        // =====================================================
        [HttpPatch("assignments/{id:int}/pickup-success")]
        public async Task<IActionResult> PickupSuccess(int id)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message = "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == id &&
                    x.StaffId == staff.Id &&
                    x.IsActive
                );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment = await _context.Shipments
                .FirstOrDefaultAsync(
                    x => x.Id == assignment.ShipmentId
                );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "picking_up")
            {
                return Conflict(new
                {
                    message = "Đơn hàng chưa ở trạng thái đang lấy hàng."
                });
            }

            shipment.Status = "picked_up";

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "picked_up",
                    At = DateTime.UtcNow,
                    Note = $"{staff.EmployeeCode} đã lấy hàng thành công."
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Xác nhận lấy hàng thành công.",
                shipment = new
                {
                    id = shipment.Id,
                    status = shipment.Status
                }
            });
        }

        // =====================================================
        // LẤY HÀNG THẤT BẠI
        // PATCH: /api/v1/staff/assignments/{id}/pickup-failed
        // =====================================================
        [HttpPatch("assignments/{id:int}/pickup-failed")]
        public async Task<IActionResult> PickupFailed(
            int id,
            [FromBody] FailureReasonRequest request)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message = "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == id &&
                    x.StaffId == staff.Id &&
                    x.IsActive
                );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment = await _context.Shipments
                .FirstOrDefaultAsync(
                    x => x.Id == assignment.ShipmentId
                );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "picking_up")
            {
                return Conflict(new
                {
                    message = "Đơn hàng chưa ở trạng thái đang lấy hàng."
                });
            }

            var reason = request.Reason?.Trim()
                ?? string.Empty;

            if (string.IsNullOrWhiteSpace(reason))
            {
                return BadRequest(new
                {
                    message = "Vui lòng nhập lý do lấy hàng thất bại."
                });
            }

            if (reason.Length > 300)
            {
                return BadRequest(new
                {
                    message = "Lý do không được vượt quá 300 ký tự."
                });
            }

            shipment.Status = "pickup_failed";
            shipment.Attempts++;

            // Staff vẫn giữ assignment và có thể thử lại
            assignment.Status = "accepted";

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "pickup_failed",
                    At = DateTime.UtcNow,
                    Note = $"Lấy hàng thất bại. Lý do: {reason}"
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã ghi nhận lấy hàng thất bại.",
                shipment = new
                {
                    id = shipment.Id,
                    status = shipment.Status,
                    attempts = shipment.Attempts,
                    reason
                }
            });
        }


        // =====================================================
        // BẮT ĐẦU GIAO HÀNG
        // PATCH: /api/v1/staff/assignments/{id}/start-delivery
        // =====================================================
        [HttpPatch("assignments/{id:int}/start-delivery")]
        public async Task<IActionResult> StartDelivery(int id)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message = "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == id &&
                    x.StaffId == staff.Id &&
                    x.IsActive
                );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment = await _context.Shipments
                .FirstOrDefaultAsync(
                    x => x.Id == assignment.ShipmentId
                );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }

            // Cho phép bắt đầu giao:
            // - lần đầu sau khi lấy hàng thành công
            // - hoặc giao lại sau khi delivery_failed
            if (shipment.Status != "picked_up" &&
                shipment.Status != "delivery_failed")
            {
                return Conflict(new
                {
                    message = "Đơn hàng hiện không thể bắt đầu giao."
                });
            }

            shipment.Status = "delivering";
            assignment.Status = "in_progress";

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "delivering",
                    At = DateTime.UtcNow,
                    Note = $"{staff.EmployeeCode} bắt đầu giao hàng."
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã bắt đầu giao hàng.",

                shipment = new
                {
                    id = shipment.Id,
                    status = shipment.Status,
                    attempts = shipment.Attempts
                }
            });
        }


        // =====================================================
        // GIAO HÀNG THÀNH CÔNG
        // PATCH: /api/v1/staff/assignments/{id}/delivery-success
        // =====================================================
        [HttpPatch("assignments/{id:int}/delivery-success")]
        public async Task<IActionResult> DeliverySuccess(int id)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message = "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == id &&
                    x.StaffId == staff.Id &&
                    x.IsActive
                );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment = await _context.Shipments
                .FirstOrDefaultAsync(x =>
                    x.Id == assignment.ShipmentId
                );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "delivering")
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng chưa ở trạng thái đang giao."
                });
            }

            // =================================================
            // GHI NHẬN COD
            // =================================================
            // Nếu đơn có COD thì khi giao thành công,
            // Staff phải thu đủ số COD của đơn.
            shipment.CodCollected = shipment.CodAmount;

            // =================================================
            // HOÀN TẤT SHIPMENT
            // =================================================
            shipment.Status = "delivered";

            // =================================================
            // HOÀN TẤT ASSIGNMENT
            // =================================================
            assignment.Status = "completed";
            assignment.IsActive = false;
            assignment.EndedAt = DateTime.UtcNow;

            // =================================================
            // GHI LỊCH SỬ
            // =================================================
            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "delivered",
                    At = DateTime.UtcNow,

                    Note = shipment.CodAmount > 0
                        ? $"{staff.EmployeeCode} giao hàng thành công và đã thu COD {shipment.CodAmount:N0}."
                        : $"{staff.EmployeeCode} giao hàng thành công."
                }
            );

            // Kết thúc phiên theo dõi vị trí gắn với nhiệm vụ vừa hoàn tất.
            // Không giữ lại GPS cuối cùng để Operations tiếp tục thấy trên bản đồ.
            var trackedLocation = await _context.StaffLocations
                .FirstOrDefaultAsync(x => x.StaffId == staff.Id && x.AssignmentId == assignment.Id);
            if (trackedLocation != null)
            {
                _context.StaffLocations.Remove(trackedLocation);
                _context.ShipmentEvents.Add(new ShipmentEvent
                {
                    ShipmentId = shipment.Id,
                    Status = "location_tracking_ended",
                    At = DateTime.UtcNow,
                    Note = $"{staff.EmployeeCode}: kết thúc chia sẻ vị trí cho đơn hàng sau khi giao thành công."
                });
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Giao hàng thành công.",

                shipment = new
                {
                    id = shipment.Id,

                    status = shipment.Status,

                    codAmount = shipment.CodAmount,

                    codCollected = shipment.CodCollected
                },

                assignment = new
                {
                    id = assignment.Id,

                    status = assignment.Status,

                    isActive = assignment.IsActive,

                    endedAt = assignment.EndedAt
                }
            });
        }

        // =====================================================
        // GIAO HÀNG THẤT BẠI
        // PATCH: /api/v1/staff/assignments/{id}/delivery-failed
        // =====================================================
        [HttpPatch("assignments/{id:int}/delivery-failed")]
        public async Task<IActionResult> DeliveryFailed(
            int id,
            [FromBody] FailureReasonRequest request)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message = "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x =>
                    x.Id == id &&
                    x.StaffId == staff.Id &&
                    x.IsActive
                );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment = await _context.Shipments
                .FirstOrDefaultAsync(x =>
                    x.Id == assignment.ShipmentId
                );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "delivering")
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng chưa ở trạng thái đang giao."
                });
            }

            var reason = request.Reason.Trim();

            // =================================================
            // ĐẾM SỐ LẦN GIAO THẤT BẠI
            // =================================================

            var previousDeliveryFailures =
                await _context.ShipmentEvents
                    .CountAsync(x =>
                        x.ShipmentId == shipment.Id &&
                        x.Status == "delivery_failed"
                    );

            var deliveryAttempts =
                previousDeliveryFailures + 1;

            // Attempts hiện tại giữ vai trò tổng số lần thất bại
            shipment.Attempts++;

            // =================================================
            // GHI NHẬN LẦN GIAO THẤT BẠI
            // =================================================

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId = shipment.Id,

                    Status = "delivery_failed",

                    At = DateTime.UtcNow,

                    Note =
                        $"Giao hàng thất bại lần {deliveryAttempts}. " +
                        $"Lý do: {reason}"
                }
            );

            // =================================================
            // ĐÃ ĐẠT GIỚI HẠN → CHUYỂN HOÀN
            // =================================================

            if (deliveryAttempts >= MaxDeliveryAttempts)
            {
                shipment.Status =
                    "return_pending";

                assignment.Status =
                    "in_progress";

                _context.ShipmentEvents.Add(
                    new ShipmentEvent
                    {
                        ShipmentId = shipment.Id,

                        Status = "return_pending",

                        At = DateTime.UtcNow,

                        Note =
                            $"Đã giao thất bại {deliveryAttempts} lần. " +
                            "Đơn hàng chuyển sang chờ hoàn."
                    }
                );

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message =
                        "Đã đạt số lần giao tối đa. Đơn hàng chuyển sang chờ hoàn.",

                    shipment = new
                    {
                        id = shipment.Id,

                        status = shipment.Status,

                        attempts = shipment.Attempts,

                        deliveryAttempts,

                        maxDeliveryAttempts =
                            MaxDeliveryAttempts,

                        reason
                    }
                });
            }

            // =================================================
            // CHƯA ĐẠT GIỚI HẠN → CHO GIAO LẠI
            // =================================================

            shipment.Status =
                "delivery_failed";

            assignment.Status =
                "in_progress";

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Đã ghi nhận giao hàng thất bại. Có thể thử giao lại.",

                shipment = new
                {
                    id = shipment.Id,

                    status = shipment.Status,

                    attempts = shipment.Attempts,

                    deliveryAttempts,

                    remainingAttempts =
                        MaxDeliveryAttempts -
                        deliveryAttempts,

                    reason
                }
            });
        }

        // =====================================================
        // BẮT ĐẦU HOÀN HÀNG
        // PATCH: /api/v1/staff/assignments/{id}/start-return
        // =====================================================
        [HttpPatch("assignments/{id:int}/start-return")]
        public async Task<IActionResult> StartReturn(int id)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment =
                await _context.DeliveryAssignments
                    .FirstOrDefaultAsync(x =>
                        x.Id == id &&
                        x.StaffId == staff.Id &&
                        x.IsActive
                    );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment =
                await _context.Shipments
                    .FirstOrDefaultAsync(
                        x => x.Id ==
                            assignment.ShipmentId
                    );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "return_pending")
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng chưa ở trạng thái chờ hoàn."
                });
            }

            shipment.Status =
                "returning";

            assignment.Status =
                "in_progress";

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId =
                        shipment.Id,

                    Status =
                        "returning",

                    At =
                        DateTime.UtcNow,

                    Note =
                        $"{staff.EmployeeCode} bắt đầu hoàn hàng."
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Đã bắt đầu hoàn hàng.",

                shipment = new
                {
                    id =
                        shipment.Id,

                    status =
                        shipment.Status
                }
            });
        }

        // =====================================================
        // HOÀN HÀNG THÀNH CÔNG
        // PATCH: /api/v1/staff/assignments/{id}/return-complete
        // =====================================================
        [HttpPatch("assignments/{id:int}/return-complete")]
        public async Task<IActionResult> ReturnComplete(int id)
        {
            var staff = await GetCurrentStaffAsync();

            if (staff == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Không tìm thấy hồ sơ nhân viên."
                });
            }

            var assignment =
                await _context.DeliveryAssignments
                    .FirstOrDefaultAsync(x =>
                        x.Id == id &&
                        x.StaffId == staff.Id &&
                        x.IsActive
                    );

            if (assignment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy phân công hợp lệ."
                });
            }

            var shipment =
                await _context.Shipments
                    .FirstOrDefaultAsync(
                        x => x.Id ==
                            assignment.ShipmentId
                    );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "returning")
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng chưa ở trạng thái đang hoàn."
                });
            }

            // =================================================
            // HOÀN TẤT SHIPMENT
            // =================================================

            shipment.Status =
                "returned";

            // Đơn hoàn thì không thu COD
            shipment.CodCollected =
                0;

            // =================================================
            // HOÀN TẤT ASSIGNMENT
            // =================================================

            assignment.Status =
                "completed";

            assignment.IsActive =
                false;

            assignment.EndedAt =
                DateTime.UtcNow;

            // =================================================
            // LỊCH SỬ
            // =================================================

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId =
                        shipment.Id,

                    Status =
                        "returned",

                    At =
                        DateTime.UtcNow,

                    Note =
                        $"{staff.EmployeeCode} đã hoàn hàng thành công."
                }
            );

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Hoàn hàng thành công.",

                shipment = new
                {
                    id =
                        shipment.Id,

                    status =
                        shipment.Status,

                    codCollected =
                        shipment.CodCollected
                },

                assignment = new
                {
                    id =
                        assignment.Id,

                    status =
                        assignment.Status,

                    isActive =
                        assignment.IsActive,

                    endedAt =
                        assignment.EndedAt
                }
            });
        }
        // =====================================================
        // STAFF BÁO CÁO SỰ CỐ
        // POST /api/v1/staff/assignments/{id}/incidents
        // =====================================================
        [HttpPost("assignments/{id:int}/incidents")]
        public async Task<IActionResult> ReportIncident(
            int id, [FromBody] CreateIncidentRequest request)
        {
            var staff = await GetCurrentStaffAsync();
            if (staff == null)
                return Unauthorized(new { message = "Không tìm thấy nhân viên đăng nhập." });

            // Chỉ báo sự cố cho đơn đang được phân công cho chính mình
            var assignment = await _context.DeliveryAssignments
                .FirstOrDefaultAsync(x => x.Id == id && x.StaffId == staff.Id);
            if (assignment == null)
                return NotFound(new { message = "Không tìm thấy đơn được phân công." });
            if (!assignment.IsActive)
                return Conflict(new { message = "Đơn này không còn trong danh sách phụ trách của bạn." });

            var type = request.Type.Trim().ToLowerInvariant();
            if (!ComplaintRules.StaffIncidentTypes.Contains(type))
                return BadRequest(new { message = "Loại sự cố không hợp lệ." });

            var description = request.Description.Trim();
            if (description.Length < 10 || description.Length > 1000)
                return BadRequest(new { message = "Mô tả sự cố phải từ 10 đến 1000 ký tự." });

            // Chống gửi trùng khi sự cố cùng loại còn đang mở
            var duplicate = await _context.Complaints.AnyAsync(x =>
                x.Source == "staff" &&
                x.ShipmentId == assignment.ShipmentId &&
                x.ReportedByStaffId == staff.Id &&
                x.Type == type &&
                x.Status != "resolved");
            if (duplicate)
                return Conflict(new { message = "Bạn đã báo sự cố này cho đơn hàng và đang được xử lý." });

            var incident = new Complaint
            {
                ShipmentId = assignment.ShipmentId,
                AssignmentId = assignment.Id,
                Source = "staff",
                CustomerId = null,
                ReportedByUserId = staff.UserId,
                ReportedByStaffId = staff.Id,
                Type = type,
                Content = description,
                Status = "pending",
                CreatedAt = DateTime.UtcNow,
                History =
                {
                    new ComplaintHistory
                    {
                        Action = "created",
                        ToStatus = "pending",
                        Note = $"Nhân viên {staff.EmployeeCode} báo sự cố",
                        ActorUserId = staff.UserId,
                        ActorRole = "staff",
                        CreatedAt = DateTime.UtcNow
                    }
                }
            };

            _context.Complaints.Add(incident);
            await _context.SaveChangesAsync();

            return StatusCode(StatusCodes.Status201Created, new
            {
                incident.Id, incident.ShipmentId, incident.Source, incident.Type,
                incident.Content, incident.Status, incident.Response,
                incident.CreatedAt, incident.ResolvedAt
            });
        }

        // =====================================================
        // STAFF THEO DÕI SỰ CỐ ĐÃ BÁO
        // GET /api/v1/staff/incidents
        // =====================================================
        [HttpGet("incidents")]
        public async Task<IActionResult> MyIncidents()
        {
            var staff = await GetCurrentStaffAsync();
            if (staff == null)
                return Unauthorized(new { message = "Không tìm thấy nhân viên đăng nhập." });

            var items = await _context.Complaints.AsNoTracking()
                .Where(x => x.Source == "staff" && x.ReportedByStaffId == staff.Id)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    x.Id, x.ShipmentId, x.AssignmentId, x.Type, x.Content,
                    x.Status, x.Response, x.CreatedAt, x.ResolvedAt
                })
                .ToListAsync();
            return Ok(items);
        }
    }
}   