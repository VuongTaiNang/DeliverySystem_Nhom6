using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Data;
using System.Security.Cryptography;
using System.Text;


namespace Back_DeliverySystem.Controllers
{
    [ApiController]
    [Route("api/v1/operations")]
    [Authorize(Roles = "operations")]
    public class OperationsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OperationsController(AppDbContext context)
        {
            _context = context;
        }

        // =========================================================
        // DASHBOARD
        // GET: /api/v1/operations/dashboard
        // =========================================================
        [HttpGet("dashboard")]
        public async Task<IActionResult> Dashboard()
        {
            // 1. Thống kê đơn hàng
            var totalOrders = await _context.Shipments
                .AsNoTracking()
                .CountAsync();

            var unassignedOrders = await _context.Shipments
                .AsNoTracking()
                .Where(s =>
                    (s.Status == "pending_pickup" ||
                     s.Status == "pickup_failed") &&
                    !_context.DeliveryAssignments.Any(a =>
                        a.ShipmentId == s.Id && a.IsActive))
                .CountAsync();

            var inDeliveryOrders = await _context.Shipments
                .AsNoTracking()
                .CountAsync(s =>
                    s.Status == "out_for_delivery" ||
                    s.Status == "delivering");

            var deliveredOrders = await _context.Shipments
                .AsNoTracking()
                .CountAsync(s => s.Status == "delivered");

            var failedOrders = await _context.Shipments
                .AsNoTracking()
                .CountAsync(s => s.Status == "delivery_failed");

            var returnedOrders = await _context.Shipments
                .AsNoTracking()
                .CountAsync(s =>
                    s.Status == "return_pending" ||
                    s.Status == "returning" ||
                    s.Status == "returned" ||
                    s.Status == "return_confirmed");

            // 2. Thống kê nhân viên
            var availableStaff = await _context.Staffs
                .AsNoTracking()
                .CountAsync(s =>
                    s.Status == "available" && s.IsAvailable);

            var busyStaff = await _context.Staffs
                .AsNoTracking()
                .CountAsync(s =>
                    s.Status == "busy" ||
                    (s.Status != "inactive" && !s.IsAvailable));

            var inactiveStaff = await _context.Staffs
                .AsNoTracking()
                .CountAsync(s => s.Status == "inactive");

            // 3. Số đơn theo nhân viên đang được phân công
            var ordersByStaff = await (
                from assignment in _context.DeliveryAssignments.AsNoTracking()
                where assignment.IsActive
                join staff in _context.Staffs.AsNoTracking()
                    on assignment.StaffId equals staff.Id
                join user in _context.Users.AsNoTracking()
                    on staff.UserId equals user.Id
                group assignment by new
                {
                    staff.Id,
                    staff.EmployeeCode,
                    user.FullName
                } into grouped
                orderby grouped.Count() descending
                select new
                {
                    staffId = grouped.Key.Id,
                    employeeCode = grouped.Key.EmployeeCode,
                    staffName = grouped.Key.FullName,
                    totalOrders = grouped.Count()
                }
            ).ToListAsync();

            // 4. Số đơn theo khu vực giao hàng
            var ordersByArea = await (
                from shipment in _context.Shipments.AsNoTracking()
                where shipment.DeliveryAreaId != null
                join area in _context.Areas.AsNoTracking()
                    on shipment.DeliveryAreaId equals area.Id
                group shipment by new
                {
                    area.Id,
                    area.Code,
                    area.Name
                } into grouped
                orderby grouped.Count() descending
                select new
                {
                    areaId = grouped.Key.Id,
                    areaCode = grouped.Key.Code,
                    areaName = grouped.Key.Name,
                    totalOrders = grouped.Count()
                }
            ).ToListAsync();

            // 5. Tỷ lệ vận hành
            var resolvedOrders = deliveredOrders + failedOrders;

            var successRate = resolvedOrders == 0
                ? 0
                : Math.Round(
                    (double)deliveredOrders / resolvedOrders * 100, 2);

            var failureRate = resolvedOrders == 0
                ? 0
                : Math.Round(
                    (double)failedOrders / resolvedOrders * 100, 2);

            return Ok(new
            {
                totalOrders,
                unassignedOrders,
                inDeliveryOrders,
                deliveredOrders,
                failedOrders,
                returnedOrders,

                staff = new
                {
                    available = availableStaff,
                    busy = busyStaff,
                    inactive = inactiveStaff,
                    total = availableStaff + busyStaff + inactiveStaff
                },

                successRate,
                failureRate,

                ordersByStaff,
                ordersByArea,

                updatedAt = DateTime.UtcNow
            });
        }

        // =========================================================
        // DANH SÁCH NHÂN VIÊN GIAO HÀNG
        // GET: /api/v1/operations/staff
        // =========================================================
        [HttpGet("staff")]
        public async Task<IActionResult> GetStaffs()
        {
            var staffs =
                await (
                    from staff in
                        _context.Staffs.AsNoTracking()

                    join user in
                        _context.Users.AsNoTracking()

                    on staff.UserId equals user.Id

                    orderby staff.Id descending

                    select new
                    {
                        id = staff.Id,

                        employeeCode =
                            staff.EmployeeCode,

                        userId =
                            user.Id,

                        fullName =
                            user.FullName,

                        email =
                            user.Email,

                        phone =
                            user.Phone,

                        area =
                            staff.Area,

                        status =
                            staff.Status,

                        isAvailable =
                            staff.IsAvailable,

                        role =
                            user.Role,

                        createdAt =
                            staff.CreatedAt
                    }
                )
                .ToListAsync();

            return Ok(staffs);
        }

        // =========================================================
        // THÊM NHÂN VIÊN GIAO HÀNG
        // POST: /api/v1/operations/staff
        // =========================================================
        [HttpPost("staff")]
        public async Task<IActionResult> CreateStaff(
            [FromBody] CreateStaffRequest request)
        {
            // Kiểm tra dữ liệu bắt buộc
            if (string.IsNullOrWhiteSpace(
                    request.FullName) ||
                string.IsNullOrWhiteSpace(
                    request.Phone) ||
                string.IsNullOrWhiteSpace(
                    request.Email) ||
                string.IsNullOrWhiteSpace(
                    request.Password))
            {
                return BadRequest(new
                {
                    message =
                        "Vui lòng nhập đầy đủ thông tin nhân viên."
                });
            }

            var fullName =
                request.FullName.Trim();

            var phone =
                request.Phone.Trim();

            var email =
                request.Email
                    .Trim()
                    .ToLowerInvariant();

            var area =
                string.IsNullOrWhiteSpace(
                    request.Area)
                    ? "Chưa phân công"
                    : request.Area.Trim();

            // Kiểm tra số điện thoại
            if (!System.Text.RegularExpressions
                .Regex.IsMatch(
                    phone,
                    @"^0[0-9]{9}$"))
            {
                return BadRequest(new
                {
                    message =
                        "Số điện thoại phải gồm 10 số và bắt đầu bằng 0."
                });
            }

            // Kiểm tra email
            if (!System.Text.RegularExpressions
                .Regex.IsMatch(
                    email,
                    @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
            {
                return BadRequest(new
                {
                    message =
                        "Email không hợp lệ."
                });
            }

            // Kiểm tra password
            if (request.Password.Length < 8)
            {
                return BadRequest(new
                {
                    message =
                        "Mật khẩu phải có ít nhất 8 ký tự."
                });
            }

            // Email không được trùng
            var emailExists =
                await _context.Users.AnyAsync(
                    x => x.Email == email
                );

            if (emailExists)
            {
                return Conflict(new
                {
                    message =
                        "Email này đã được sử dụng."
                });
            }

            // Phone không được trùng
            var phoneExists =
                await _context.Users.AnyAsync(
                    x => x.Phone == phone
                );

            if (phoneExists)
            {
                return Conflict(new
                {
                    message =
                        "Số điện thoại này đã được sử dụng."
                });
            }

            await using var transaction =
                await _context.Database
                    .BeginTransactionAsync();

            try
            {
                // =================================================
                // 1. TẠO USER ACCOUNT
                // =================================================
                var user = new User
                {
                    FullName = fullName,

                    ShopName = null,

                    Phone = phone,

                    Email = email,

                    PasswordHash =
                        HashPassword(
                            request.Password
                        ),

                    Role = "staff",

                    AccountType = "internal",

                    CreatedAt = DateTime.UtcNow
                };

                _context.Users.Add(user);

                await _context.SaveChangesAsync();

                // =================================================
                // 2. TẠO STAFF PROFILE
                // =================================================
                var staff = new Staff
                {
                    UserId = user.Id,

                    EmployeeCode =
                        GenerateTemporaryEmployeeCode(),

                    Area = area,

                    Status = "available",

                    IsAvailable = true,

                    CreatedAt = DateTime.UtcNow
                };

                _context.Staffs.Add(staff);

                await _context.SaveChangesAsync();

                // Sau khi đã có Staff.Id
                // chuyển mã tạm thành mã chính thức
                staff.EmployeeCode =
                    $"STF{staff.Id:0000}";

                await _context.SaveChangesAsync();

                await transaction.CommitAsync();

                return StatusCode(
                    StatusCodes.Status201Created,
                    new
                    {
                        message =
                            "Thêm nhân viên giao hàng thành công.",

                        staff = new
                        {
                            id =
                                staff.Id,

                            employeeCode =
                                staff.EmployeeCode,

                            userId =
                                user.Id,

                            fullName =
                                user.FullName,

                            email =
                                user.Email,

                            phone =
                                user.Phone,

                            area =
                                staff.Area,

                            status =
                                staff.Status,

                            isAvailable =
                                staff.IsAvailable,

                            role =
                                user.Role,

                            accountType =
                                user.AccountType,

                            createdAt =
                                staff.CreatedAt
                        }
                    }
                );
            }
            catch
            {
                await transaction.RollbackAsync();

                return StatusCode(
                    StatusCodes
                        .Status500InternalServerError,
                    new
                    {
                        message =
                            "Có lỗi xảy ra khi thêm nhân viên giao hàng."
                    }
                );
            }
        }


        // =========================================================
        // XEM CHI TIẾT NHÂN VIÊN
        // GET: /api/v1/operations/staff/{id}
        // =========================================================
        [HttpGet("staff/{id:int}")]
        public async Task<IActionResult> GetStaffById(int id)
        {
            var staff =
                await (
                    from s in _context.Staffs.AsNoTracking()

                    join user in _context.Users.AsNoTracking()
                        on s.UserId equals user.Id

                    where s.Id == id

                    select new
                    {
                        id = s.Id,

                        employeeCode =
                            s.EmployeeCode,

                        userId =
                            user.Id,

                        fullName =
                            user.FullName,

                        email =
                            user.Email,

                        phone =
                            user.Phone,

                        area =
                            s.Area,

                        status =
                            s.Status,

                        isAvailable =
                            s.IsAvailable,

                        role =
                            user.Role,

                        accountType =
                            user.AccountType,

                        createdAt =
                            s.CreatedAt
                    }
                )
                .FirstOrDefaultAsync();

            if (staff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên giao hàng."
                });
            }

            return Ok(staff);
        }

        // =========================================================
        // CẬP NHẬT NHÂN VIÊN
        // PUT: /api/v1/operations/staff/{id}
        // =========================================================
        [HttpPut("staff/{id:int}")]
        public async Task<IActionResult> UpdateStaff(
            int id,
            [FromBody] UpdateStaffRequest request)
        {
            var staff = await _context.Staffs
                .FirstOrDefaultAsync(x => x.Id == id);

            if (staff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên giao hàng."
                });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(
                    x => x.Id == staff.UserId
                );

            if (user == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tài khoản của nhân viên."
                });
            }

            // =====================================================
            // VALIDATION
            // =====================================================

            var fullName =
                request.FullName?.Trim()
                ?? string.Empty;

            var email =
                request.Email?
                    .Trim()
                    .ToLowerInvariant()
                ?? string.Empty;

            var phone =
                request.Phone?.Trim()
                ?? string.Empty;

            var area =
                string.IsNullOrWhiteSpace(request.Area)
                    ? "Chưa phân công"
                    : request.Area.Trim();

            if (string.IsNullOrWhiteSpace(fullName))
            {
                return BadRequest(new
                {
                    message =
                        "Họ tên không được để trống."
                });
            }

            if (!System.Text.RegularExpressions
                .Regex.IsMatch(
                    email,
                    @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
            {
                return BadRequest(new
                {
                    message =
                        "Email không hợp lệ."
                });
            }

            if (!System.Text.RegularExpressions
                .Regex.IsMatch(
                    phone,
                    @"^0[0-9]{9}$"))
            {
                return BadRequest(new
                {
                    message =
                        "Số điện thoại phải gồm 10 số và bắt đầu bằng 0."
                });
            }

            // =====================================================
            // CHECK EMAIL TRÙNG
            // =====================================================

            var emailExists =
                await _context.Users.AnyAsync(
                    x =>
                        x.Id != user.Id &&
                        x.Email == email
                );

            if (emailExists)
            {
                return Conflict(new
                {
                    message =
                        "Email này đã được sử dụng."
                });
            }

            // =====================================================
            // CHECK PHONE TRÙNG
            // =====================================================

            var phoneExists =
                await _context.Users.AnyAsync(
                    x =>
                        x.Id != user.Id &&
                        x.Phone == phone
                );

            if (phoneExists)
            {
                return Conflict(new
                {
                    message =
                        "Số điện thoại này đã được sử dụng."
                });
            }

            // =====================================================
            // UPDATE USER
            // =====================================================

            user.FullName = fullName;
            user.Email = email;
            user.Phone = phone;

            // Không cho đổi role qua API này
            user.Role = "staff";
            user.AccountType = "internal";
            user.ShopName = null;

            // =====================================================
            // UPDATE STAFF PROFILE
            // =====================================================

            staff.Area = area;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Cập nhật nhân viên thành công.",

                staff = new
                {
                    id =
                        staff.Id,

                    employeeCode =
                        staff.EmployeeCode,

                    fullName =
                        user.FullName,

                    email =
                        user.Email,

                    phone =
                        user.Phone,

                    area =
                        staff.Area,

                    status =
                        staff.Status,

                    isAvailable =
                        staff.IsAvailable
                }
            });
        }

        // =========================================================
        // CẬP NHẬT TRẠNG THÁI NHÂN VIÊN
        // PATCH: /api/v1/operations/staff/{id}/status
        // =========================================================
        [HttpPatch("staff/{id:int}/status")]
        public async Task<IActionResult> UpdateStaffStatus(
            int id,
            [FromBody] UpdateStaffStatusRequest request)
        {
            var staff = await _context.Staffs
                .FirstOrDefaultAsync(
                    x => x.Id == id
                );

            if (staff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên giao hàng."
                });
            }

            var status =
                request.Status?
                    .Trim()
                    .ToLowerInvariant()
                ?? string.Empty;

            var allowedStatuses =
                new[]
                {
            "available",
            "busy",
            "inactive"
                };

            if (!allowedStatuses.Contains(status))
            {
                return BadRequest(new
                {
                    message =
                        "Trạng thái chỉ được là available, busy hoặc inactive."
                });
            }


            // =====================================================
            // KHÔNG CHO INACTIVE NẾU STAFF CÒN ĐƠN
            // =====================================================
            if (status == "inactive")
            {
                var hasActiveAssignments =
                    await _context.DeliveryAssignments
                        .AnyAsync(x =>
                            x.StaffId == staff.Id &&
                            x.IsActive
                        );

                if (hasActiveAssignments)
                {
                    return Conflict(new
                    {
                        message =
                            "Không thể chuyển nhân viên sang inactive khi vẫn còn đơn đang được phân công."
                    });
                }
            }


            staff.Status = status;

            staff.IsAvailable =
                status == "available";

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message =
                    "Cập nhật trạng thái nhân viên thành công.",

                staff = new
                {
                    id =
                        staff.Id,

                    employeeCode =
                        staff.EmployeeCode,

                    status =
                        staff.Status,

                    isAvailable =
                        staff.IsAvailable
                }
            });
        }



        // =========================================================
        // XEM ĐƠN MỚI CHƯA PHÂN CÔNG
        // GET: /api/v1/operations/shipments/new
        // =========================================================
        [HttpGet("shipments/new")]
        public async Task<IActionResult> GetNewShipments()
        {
            var shipments = await _context.Shipments
                .AsNoTracking()
                .Where(x =>
                    x.Status == "pending_pickup" &&

                    !_context.DeliveryAssignments.Any(
                        a =>
                            a.ShipmentId == x.Id &&
                            a.IsActive
                    ) &&

                    (
                        x.FeePayer != "shop_prepaid" ||

                        _context.Payments.Any(
                            p =>
                                p.ShipmentId == x.Id &&
                                p.Status == "paid"
                        )
                    )
                )
                .OrderBy(x => x.CreatedAt)
                .Select(x => new
                {
                    id = x.Id,
                    customerId = x.CustomerId,

                    senderName = x.SenderName,
                    senderPhone = x.SenderPhone,
                    pickupAddress = x.PickupAddress,

                    recipientName = x.RecipientName,
                    recipientPhone = x.RecipientPhone,
                    deliveryAddress = x.DeliveryAddress,

                    goods = x.Goods,

                    weightKg = x.WeightKg,
                    codAmount = x.CodAmount,

                    vehicleType = x.VehicleType,
                    service = x.Service,
                    fee = x.Fee,

                    status = x.Status,
                    createdAt = x.CreatedAt
                })
                .ToListAsync();

            return Ok(shipments);
        }


        // =========================================================
        // DANH SÁCH TOÀN BỘ ĐƠN HÀNG
        // GET: /api/v1/operations/shipments
        // =========================================================
        [HttpGet("shipments")]
        public async Task<IActionResult> GetShipments(
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int? customerId,
            [FromQuery] int? staffId,
            [FromQuery] string sort = "newest",
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1)
            {
                return BadRequest(new
                {
                    message = "Page phải lớn hơn hoặc bằng 1."
                });
            }

            if (pageSize < 1 || pageSize > 100)
            {
                return BadRequest(new
                {
                    message =
                        "PageSize phải từ 1 đến 100."
                });
            }


            IQueryable<Shipment> query =
                _context.Shipments
                    .AsNoTracking();


            if (!string.IsNullOrWhiteSpace(status))
            {
                var normalizedStatus =
                    status.Trim().ToLowerInvariant();

                query = query.Where(
                    x => x.Status == normalizedStatus
                );
            }


            if (customerId.HasValue)
            {
                query = query.Where(
                    x => x.CustomerId == customerId.Value
                );
            }


            if (staffId.HasValue)
            {
                query = query.Where(x =>
                    _context.DeliveryAssignments.Any(a =>
                        a.ShipmentId == x.Id &&
                        a.StaffId == staffId.Value &&
                        a.IsActive
                    )
                );
            }


            if (!string.IsNullOrWhiteSpace(search))
            {
                var keyword =
                    search.Trim();

                query = query.Where(x =>
                    x.Id.Contains(keyword) ||
                    x.SenderName.Contains(keyword) ||
                    x.SenderPhone.Contains(keyword) ||
                    x.RecipientName.Contains(keyword) ||
                    x.RecipientPhone.Contains(keyword) ||
                    x.PickupAddress.Contains(keyword) ||
                    x.DeliveryAddress.Contains(keyword)
                );
            }


            var totalItems =
                await query.CountAsync();


            query =
                sort.Trim().ToLowerInvariant() == "oldest"
                    ? query.OrderBy(x => x.CreatedAt)
                    : query.OrderByDescending(x => x.CreatedAt);


            var shipments =
                await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();


            var shipmentIds =
                shipments
                    .Select(x => x.Id)
                    .ToList();


            var activeAssignments =
                await (
                    from assignment in
                        _context.DeliveryAssignments.AsNoTracking()

                    join staff in
                        _context.Staffs.AsNoTracking()
                        on assignment.StaffId equals staff.Id

                    join user in
                        _context.Users.AsNoTracking()
                        on staff.UserId equals user.Id

                    where
                        shipmentIds.Contains(
                            assignment.ShipmentId
                        ) &&
                        assignment.IsActive

                    select new
                    {
                        shipmentId =
                            assignment.ShipmentId,

                        id =
                            assignment.Id,

                        staffId =
                            staff.Id,

                        employeeCode =
                            staff.EmployeeCode,

                        staffName =
                            user.FullName,

                        assignmentStatus =
                            assignment.Status,

                        assignedAt =
                            assignment.AssignedAt
                    }
                )
                .ToListAsync();


            var assignmentMap =
                activeAssignments
                    .GroupBy(x => x.shipmentId)
                    .ToDictionary(
                        x => x.Key,
                        x => x
                            .OrderByDescending(
                                a => a.assignedAt
                            )
                            .First()
                    );


            var result =
                shipments.Select(x =>
                {
                    assignmentMap.TryGetValue(
                        x.Id,
                        out var assignment
                    );

                    return new
                    {
                        id = x.Id,

                        customerId =
                            x.CustomerId,

                        senderName =
                            x.SenderName,

                        senderPhone =
                            x.SenderPhone,

                        pickupAddress =
                            x.PickupAddress,

                        recipientName =
                            x.RecipientName,

                        recipientPhone =
                            x.RecipientPhone,

                        deliveryAddress =
                            x.DeliveryAddress,

                        goods =
                            x.Goods,

                        weightKg =
                            x.WeightKg,

                        codAmount =
                            x.CodAmount,

                        codCollected =
                            x.CodCollected,

                        fee =
                            x.Fee,

                        feePayer =
                            x.FeePayer,

                        vehicleType =
                            x.VehicleType,

                        service =
                            x.Service,

                        status =
                            x.Status,

                        attempts =
                            x.Attempts,

                        createdAt =
                            x.CreatedAt,

                        activeAssignment =
                            assignment == null
                                ? null
                                : new
                                {
                                    assignment.id,
                                    assignment.staffId,
                                    assignment.employeeCode,
                                    assignment.staffName,
                                    assignment.assignmentStatus,
                                    assignment.assignedAt
                                }
                    };
                });


            return Ok(new
            {
                page,
                pageSize,
                totalItems,

                totalPages =
                    (int)Math.Ceiling(
                        totalItems /
                        (double)pageSize
                    ),

                items =
                    result
            });
        }


        // =========================================================
        // CHI TIẾT ĐƠN HÀNG
        // GET: /api/v1/operations/shipments/{shipmentId}
        // =========================================================
        [HttpGet("shipments/{shipmentId}")]
        public async Task<IActionResult> GetShipmentById(
            string shipmentId)
        {
            var shipment =
                await _context.Shipments
                    .Include(x => x.Events)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x => x.Id == shipmentId
                    );


            if (shipment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn hàng."
                });
            }


            var assignments =
                await (
                    from assignment in
                        _context.DeliveryAssignments.AsNoTracking()

                    join staff in
                        _context.Staffs.AsNoTracking()
                        on assignment.StaffId equals staff.Id

                    join staffUser in
                        _context.Users.AsNoTracking()
                        on staff.UserId equals staffUser.Id

                    // LEFT JOIN: auto-assignment has AssignedByUserId = null.
                    join assignedByUser in
                        _context.Users.AsNoTracking()
                        on assignment.AssignedByUserId
                        equals (int?)assignedByUser.Id into assignedByUsers

                    from assignedBy in assignedByUsers.DefaultIfEmpty()

                    where
                        assignment.ShipmentId ==
                        shipment.Id

                    orderby
                        assignment.AssignedAt descending

                    select new
                    {
                        id =
                            assignment.Id,

                        staffId =
                            staff.Id,

                        employeeCode =
                            staff.EmployeeCode,

                        staffName =
                            staffUser.FullName,

                        assignedByUserId =
                            assignment.AssignedByUserId,

                        assignedByName =
                            assignedBy == null
                                ? "Hệ thống (Auto)"
                                : assignedBy.FullName,

                        assignmentSource =
                            assignment.AssignmentSource,

                        assignedAt =
                            assignment.AssignedAt,

                        status =
                            assignment.Status,

                        isActive =
                            assignment.IsActive,

                        acceptedAt =
                            assignment.AcceptedAt,

                        endedAt =
                            assignment.EndedAt,

                        rejectionReason =
                            assignment.RejectionReason
                    }
                )
                .ToListAsync();


            return Ok(new
            {
                shipment = new
                {
                    id =
                        shipment.Id,

                    customerId =
                        shipment.CustomerId,

                    senderName =
                        shipment.SenderName,

                    senderPhone =
                        shipment.SenderPhone,

                    pickupAddress =
                        shipment.PickupAddress,

                    recipientName =
                        shipment.RecipientName,

                    recipientPhone =
                        shipment.RecipientPhone,

                    deliveryAddress =
                        shipment.DeliveryAddress,

                    goods =
                        shipment.Goods,

                    weightKg =
                        shipment.WeightKg,

                    lengthCm =
                        shipment.LengthCm,

                    widthCm =
                        shipment.WidthCm,

                    heightCm =
                        shipment.HeightCm,

                    declaredValue =
                        shipment.DeclaredValue,

                    codAmount =
                        shipment.CodAmount,

                    codCollected =
                        shipment.CodCollected,

                    fee =
                        shipment.Fee,

                    feePayer =
                        shipment.FeePayer,

                    vehicleType =
                        shipment.VehicleType,

                    service =
                        shipment.Service,

                    notes =
                        shipment.Notes,

                    status =
                        shipment.Status,

                    attempts =
                        shipment.Attempts,

                    currentHubId =
                        shipment.CurrentHubId,

                    createdAt =
                        shipment.CreatedAt
                },

                events =
                    shipment.Events
                        .OrderBy(x => x.At)
                        .Select(x => new
                        {
                            x.Id,
                            x.Status,
                            x.At,
                            x.Note
                        }),

                assignmentHistory =
                    assignments
            });
        }


        // =========================================================
        // HỦY PHÂN CÔNG
        // PATCH: /api/v1/operations/assignments/{id}/cancel
        // =========================================================
        [HttpPatch("assignments/{id:int}/cancel")]
        public async Task<IActionResult> CancelAssignment(
            int id,
            [FromBody] CancelAssignmentRequest request)
        {
            var assignment =
                await _context.DeliveryAssignments
                    .FirstOrDefaultAsync(x =>
                        x.Id == id &&
                        x.IsActive
                    );


            if (assignment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy phân công đang hoạt động."
                });
            }


            var shipment =
                await _context.Shipments
                    .FirstOrDefaultAsync(
                        x =>
                            x.Id ==
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


            if (shipment.Status != "pending_pickup" &&
                shipment.Status != "pickup_failed")
            {
                return Conflict(new
                {
                    message =
                        "Không thể hủy phân công sau khi hàng đã được lấy thành công."
                });
            }


            var reason =
                request.Reason.Trim();


            assignment.Status =
                "cancelled";

            assignment.IsActive =
                false;

            assignment.EndedAt =
                DateTime.UtcNow;


            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId =
                        shipment.Id,

                    Status =
                        "assignment_cancelled",

                    At =
                        DateTime.UtcNow,

                    Note =
                        $"Operations hủy phân công. Lý do: {reason}"
                }
            );


            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Hủy phân công thành công.",

                assignment = new
                {
                    id =
                        assignment.Id,

                    shipmentId =
                        assignment.ShipmentId,

                    status =
                        assignment.Status,

                    isActive =
                        assignment.IsActive,

                    endedAt =
                        assignment.EndedAt
                }
            });
        }

        // =========================================================
        // ĐỔI NHÂN VIÊN GIAO HÀNG
        // PATCH: /api/v1/operations/shipments/{shipmentId}/reassign
        // =========================================================
        [HttpPatch("shipments/{shipmentId}/reassign")]
        public async Task<IActionResult> ReassignShipment(
            string shipmentId,
            [FromBody] ReassignShipmentRequest request)
        {
            var operationsUserId =
                GetCurrentOperationsUserId();


            if (operationsUserId == null)
            {
                return Unauthorized(new
                {
                    message =
                        "Thông tin đăng nhập không hợp lệ."
                });
            }


            // SERIALIZABLE: capacity checks and reassignment are atomic.
            await using var transaction =
                await _context.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable
                );

            var shipment =
                await _context.Shipments
                    .FirstOrDefaultAsync(
                        x => x.Id == shipmentId
                    );


            if (shipment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn hàng."
                });
            }


            if (shipment.Status != "pending_pickup" &&
                shipment.Status != "pickup_failed")
            {
                return Conflict(new
                {
                    message =
                        "Chỉ có thể đổi nhân viên khi đơn đang chờ lấy hàng hoặc lấy hàng thất bại."
                });
            }


            var currentAssignment =
                await _context.DeliveryAssignments
                    .FirstOrDefaultAsync(x =>
                        x.ShipmentId == shipment.Id &&
                        x.IsActive
                    );


            if (currentAssignment == null)
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng hiện không có phân công đang hoạt động. Hãy sử dụng chức năng phân công."
                });
            }


            if (currentAssignment.StaffId ==
                request.StaffId)
            {
                return Conflict(new
                {
                    message =
                        "Nhân viên mới đang là người được phân công cho đơn này."
                });
            }


            var newStaff =
                await _context.Staffs
                    .FirstOrDefaultAsync(
                        x => x.Id == request.StaffId
                    );


            if (newStaff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên mới."
                });
            }


            var newStaffUser =
                await _context.Users
                    .FirstOrDefaultAsync(
                        x => x.Id == newStaff.UserId
                    );


            if (newStaffUser == null ||
                newStaffUser.Role != "staff")
            {
                return BadRequest(new
                {
                    message =
                        "Tài khoản Staff mới không hợp lệ."
                });
            }


            if (newStaff.Status != "available" ||
                !newStaff.IsAvailable)
            {
                return Conflict(new
                {
                    message =
                        "Nhân viên mới hiện không sẵn sàng nhận đơn."
                });
            }


            var capacityError = await ValidateManualAreaCapacityAsync(
                shipment, newStaff.Id
            );
            if (capacityError != null)
            {
                return capacityError;
            }

            var oldStaff =
                await _context.Staffs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        x =>
                            x.Id ==
                            currentAssignment.StaffId
                    );


            User? oldStaffUser = null;


            if (oldStaff != null)
            {
                oldStaffUser =
                    await _context.Users
                        .AsNoTracking()
                        .FirstOrDefaultAsync(
                            x =>
                                x.Id ==
                                oldStaff.UserId
                        );
            }


            var reason =
                request.Reason.Trim();


            try
            {
                var now =
                    DateTime.UtcNow;


                currentAssignment.Status =
                    "cancelled";

                currentAssignment.IsActive =
                    false;

                currentAssignment.EndedAt =
                    now;


                var newAssignment =
                    new DeliveryAssignment
                    {
                        ShipmentId =
                            shipment.Id,

                        StaffId =
                            newStaff.Id,

                        AssignedByUserId =
                            operationsUserId.Value,

                        AssignmentSource = "manual",

                        AssignedAt =
                            now,

                        Status =
                            "assigned",

                        IsActive =
                            true
                    };


                _context.DeliveryAssignments.Add(
                    newAssignment
                );


                var oldStaffName =
                    oldStaffUser?.FullName ??
                    "Staff cũ";


                var oldCode =
                    oldStaff?.EmployeeCode ??
                    "N/A";


                _context.ShipmentEvents.Add(
                    new ShipmentEvent
                    {
                        ShipmentId =
                            shipment.Id,

                        Status =
                            "staff_reassigned",

                        At =
                            now,

                        Note =
                            $"Đổi nhân viên từ {oldStaffName} ({oldCode}) " +
                            $"sang {newStaffUser.FullName} ({newStaff.EmployeeCode}). " +
                            $"Lý do: {reason}"
                    }
                );


                await _context.SaveChangesAsync();


                await transaction.CommitAsync();


                return Ok(new
                {
                    message =
                        "Đổi nhân viên giao hàng thành công.",

                    previousAssignment = new
                    {
                        id =
                            currentAssignment.Id,

                        staffId =
                            currentAssignment.StaffId,

                        status =
                            currentAssignment.Status,

                        isActive =
                            currentAssignment.IsActive,

                        endedAt =
                            currentAssignment.EndedAt
                    },

                    newAssignment = new
                    {
                        id =
                            newAssignment.Id,

                        shipmentId =
                            newAssignment.ShipmentId,

                        staffId =
                            newStaff.Id,

                        employeeCode =
                            newStaff.EmployeeCode,

                        staffName =
                            newStaffUser.FullName,

                        status =
                            newAssignment.Status,

                        isActive =
                            newAssignment.IsActive,

                        assignedAt =
                            newAssignment.AssignedAt
                    }
                });
            }
            catch
            {
                await transaction.RollbackAsync();

                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new
                    {
                        message =
                            "Có lỗi xảy ra khi đổi nhân viên giao hàng."
                    }
                );
            }
        }
        

        // =========================================================
        // STAFF CÓ THỂ NHẬN ĐƠN
        // GET: /api/v1/operations/staff/available
        // =========================================================
        [HttpGet("staff/available")]
        public async Task<IActionResult> GetAvailableStaff()
        {
            var staffs =
                await (
                    from staff in _context.Staffs.AsNoTracking()

                    join user in _context.Users.AsNoTracking()
                        on staff.UserId equals user.Id

                    where
                        staff.Status == "available" &&
                        staff.IsAvailable &&
                        user.Role == "staff"

                    orderby staff.Id

                    select new
                    {
                        id = staff.Id,

                        employeeCode =
                            staff.EmployeeCode,

                        fullName =
                            user.FullName,

                        phone =
                            user.Phone,

                        area =
                            staff.Area,

                        status =
                            staff.Status,

                        currentAssignments =
                            _context.DeliveryAssignments
                                .Count(a =>
                                    a.StaffId == staff.Id &&
                                    a.IsActive
                                )
                    }
                )
                .ToListAsync();

            return Ok(staffs);
        }


        // =========================================================
        // PHÂN CÔNG ĐƠN CHO STAFF
        // POST: /api/v1/operations/shipments/{shipmentId}/assign
        // =========================================================
        [HttpPost("shipments/{shipmentId}/assign")]     
        public async Task<IActionResult> AssignShipment(
            string shipmentId,
            [FromBody] AssignShipmentRequest request)
        {
            var userIdClaim =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    userIdClaim,
                    out var operationsUserId))
            {
                return Unauthorized(new
                {
                    message =
                        "Thông tin đăng nhập không hợp lệ."
                });
            }

            // SERIALIZABLE: prevent parallel manual/auto assignment
            // from exceeding capacity.
            await using var transaction =
                await _context.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable
                );

            // ===============================
            // Kiểm tra Shipment
            // ===============================

            var shipment =
                await _context.Shipments
                    .FirstOrDefaultAsync(
                        x => x.Id == shipmentId
                    );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn hàng."
                });
            }

            if (shipment.Status != "pending_pickup" &&
                shipment.Status != "pickup_failed")
            {
                return Conflict(new
                {
                    message =
                        "Chỉ có thể phân công đơn đang chờ lấy hàng hoặc lấy hàng thất bại."
                });
            }

            // =====================================================
            // SHOP PREPAID PHẢI THANH TOÁN TRƯỚC
            // =====================================================
            if (shipment.FeePayer == "shop_prepaid")
            {
                var hasPaid =
                    await _context.Payments
                        .AnyAsync(
                            x =>
                                x.ShipmentId ==
                                    shipment.Id &&
                                x.Status == "paid"
                        );


                if (!hasPaid)
                {
                    return Conflict(new
                    {
                        message =
                            "Đơn hàng phải thanh toán phí vận chuyển trước khi phân công cho nhân viên."
                    });
                }
            }

            // ===============================
            // Đã có assignment chưa?
            // ===============================

            var hasAssignment =
                await _context.DeliveryAssignments
                    .AnyAsync(x =>
                        x.ShipmentId == shipment.Id &&
                        x.IsActive
                    );

            if (hasAssignment)
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng đã được phân công."
                });
            }

            // ===============================
            // Kiểm tra Staff
            // ===============================

            var staff =
                await _context.Staffs
                    .FirstOrDefaultAsync(
                        x => x.Id == request.StaffId
                    );

            if (staff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên giao hàng."
                });
            }

            var staffUser =
                await _context.Users
                    .FirstOrDefaultAsync(
                        x => x.Id == staff.UserId
                    );

            if (staffUser == null ||
                staffUser.Role != "staff")
            {
                return BadRequest(new
                {
                    message =
                        "Tài khoản Staff không hợp lệ."
                });
            }

            if (staff.Status != "available" ||
                !staff.IsAvailable)
            {
                return Conflict(new
                {
                    message =
                        "Nhân viên hiện không sẵn sàng nhận đơn."
                });
            }

            var capacityError = await ValidateManualAreaCapacityAsync(
                shipment, staff.Id
            );
            if (capacityError != null)
            {
                return capacityError;
            }

            // ===============================
            // Tạo Assignment
            // ===============================

            var assignment =
                new DeliveryAssignment
                {
                    ShipmentId = shipment.Id,

                    StaffId = staff.Id,

                    AssignedByUserId =
                        operationsUserId,

                    AssignmentSource = "manual",

                    AssignedAt =
                        DateTime.UtcNow,

                    Status =
                        "assigned",

                    IsActive =
                        true
                };

            _context.DeliveryAssignments.Add(
                assignment
            );

            // ===============================
            // Shipment History
            // ===============================

            _context.ShipmentEvents.Add(
                new ShipmentEvent
                {
                    ShipmentId =
                        shipment.Id,

                    Status =
                        "assigned_staff",

                    At =
                        DateTime.UtcNow,

                    Note =
                        $"Đã phân công cho {staffUser.FullName} ({staff.EmployeeCode})."
                }
            );

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message =
                    "Phân công nhân viên giao hàng thành công.",

                assignment = new
                {
                    id =
                        assignment.Id,

                    shipmentId =
                        assignment.ShipmentId,

                    staffId =
                        staff.Id,

                    employeeCode =
                        staff.EmployeeCode,

                    staffName =
                        staffUser.FullName,

                    status =
                        assignment.Status,

                    assignedAt =
                        assignment.AssignedAt
                }
            });
        }

        // Validate structured-area manual assignments. Legacy shipments without
        // DeliveryAreaId can still be assigned using the existing manual flow.
        private async Task<IActionResult?> ValidateManualAreaCapacityAsync(
            Shipment shipment,
            int staffId)
        {
            if (!shipment.DeliveryAreaId.HasValue)
            {
                return null;
            }

            var areaId = shipment.DeliveryAreaId.Value;

            var areaIsActive = await _context.Areas.AsNoTracking()
                .AnyAsync(x => x.Id == areaId && x.IsActive);

            if (!areaIsActive)
            {
                return Conflict(new
                {
                    message = "Khu vực giao hàng không tồn tại hoặc đã ngừng hoạt động."
                });
            }

            var staffArea = await _context.StaffAreas.AsNoTracking()
                .FirstOrDefaultAsync(x =>
                    x.AreaId == areaId &&
                    x.StaffId == staffId &&
                    x.IsActive);

            if (staffArea == null)
            {
                return Conflict(new
                {
                    message = "Staff không được phân công phụ trách khu vực giao hàng này."
                });
            }

            var activeOrders = await (
                from assignment in _context.DeliveryAssignments.AsNoTracking()
                join assignedShipment in _context.Shipments.AsNoTracking()
                    on assignment.ShipmentId equals assignedShipment.Id
                where assignment.IsActive &&
                      assignment.StaffId == staffId &&
                      assignedShipment.DeliveryAreaId == areaId
                select assignment.Id
            ).CountAsync();

            if (activeOrders >= staffArea.MaxActiveOrders)
            {
                return Conflict(new
                {
                    message = "Staff đã đạt giới hạn đơn tại khu vực giao hàng.",
                    activeOrders,
                    maxActiveOrders = staffArea.MaxActiveOrders
                });
            }

            return null;
        }

        // =========================================================
        // LẤY OPERATIONS USER ID TỪ JWT
        // =========================================================
        private int? GetCurrentOperationsUserId()
        {
            var value =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );


            if (!int.TryParse(
                    value,
                    out var id))
            {
                return null;
            }


            return id;
        }

        // =========================================================
        // MÃ NHÂN VIÊN TẠM
        // =========================================================
        private static string GenerateTemporaryEmployeeCode()
        {
            return "TMP" +
                Guid.NewGuid()
                    .ToString("N")
                    .Substring(0, 12)
                    .ToUpperInvariant();
        }

        // =========================================================
        // HASH PASSWORD
        // =========================================================
        private static string HashPassword(
            string password)
        {
            using var sha256 =
                SHA256.Create();

            var bytes =
                sha256.ComputeHash(
                    Encoding.UTF8.GetBytes(
                        password
                    )
                );

            return Convert.ToHexString(bytes);
        }



    }

}   