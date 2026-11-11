using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs.Operations;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Back_DeliverySystem.Controllers.Operations
{
    [ApiController]
    [Route("api/v1/operations/routes")]
    [Authorize(Roles = "operations")]
    public class OperationsRoutesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OperationsRoutesController(
            AppDbContext context)
        {
            _context = context;
        }


        // =========================================================
        // 1. TẠO TUYẾN GIAO HÀNG
        // POST /api/v1/operations/routes
        // =========================================================
        [HttpPost]
        public async Task<IActionResult> CreateRoute(
            [FromBody] CreateDeliveryRouteRequest request)
        {
            var userIdText =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    userIdText,
                    out var operationsUserId))
            {
                return Unauthorized(new
                {
                    message = "Token không hợp lệ."
                });
            }


            // Kiểm tra staff
            var staff =
                await _context.Staffs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == request.StaffId
                    );

            if (staff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên giao hàng."
                });
            }


            // Không cho staff inactive nhận route mới
            if (staff.Status == "inactive")
            {
                return BadRequest(new
                {
                    message =
                        "Nhân viên đang inactive, không thể phân công tuyến."
                });
            }


            // Sinh RouteCode
            string routeCode;

            do
            {
                routeCode =
                    $"RT-{Guid.NewGuid():N}"
                        .ToUpperInvariant();

            } while (
                await _context.DeliveryRoutes
                    .AnyAsync(x =>
                        x.RouteCode == routeCode
                    )
            );


            var route =
                new DeliveryRoute
                {
                    RouteCode =
                        routeCode,

                    Name =
                        request.Name.Trim(),

                    StaffId =
                        request.StaffId,

                    Area =
                        request.Area.Trim(),

                    PlannedDate =
                        request.PlannedDate,

                    Notes =
                        request.Notes?.Trim(),

                    Status =
                        "draft",

                    CreatedByUserId =
                        operationsUserId,

                    CreatedAt =
                        DateTime.UtcNow
                };


            _context.DeliveryRoutes.Add(
                route
            );

            await _context.SaveChangesAsync();


            return CreatedAtAction(
                nameof(GetRouteById),
                new
                {
                    id = route.Id
                },
                new
                {
                    message =
                        "Tạo tuyến giao hàng thành công.",

                    route.Id,
                    route.RouteCode,
                    route.Name,
                    route.StaffId,

                    staff.EmployeeCode,

                    StaffArea =
                        staff.Area,

                    RouteArea =
                        route.Area,

                    route.Status,
                    route.PlannedDate,
                    route.Notes,
                    route.CreatedAt
                }
            );
        }


        // =========================================================
        // 2. DANH SÁCH TUYẾN
        //
        // GET /api/v1/operations/routes
        // GET /api/v1/operations/routes?status=draft
        // GET /api/v1/operations/routes?staffId=1
        // GET /api/v1/operations/routes?search=Quan%207
        // =========================================================
        [HttpGet]
        public async Task<IActionResult> GetRoutes(
            [FromQuery] string? status,
            [FromQuery] int? staffId,
            [FromQuery] string? search)
        {
            var query =
                _context.DeliveryRoutes
                    .AsNoTracking()
                    .AsQueryable();


            if (!string.IsNullOrWhiteSpace(
                    status))
            {
                var normalizedStatus =
                    status.Trim().ToLower();

                query =
                    query.Where(x =>
                        x.Status ==
                        normalizedStatus
                    );
            }


            if (staffId.HasValue)
            {
                query =
                    query.Where(x =>
                        x.StaffId ==
                        staffId.Value
                    );
            }


            if (!string.IsNullOrWhiteSpace(
                    search))
            {
                var keyword =
                    search.Trim();

                query =
                    query.Where(x =>
                        x.RouteCode.Contains(
                            keyword
                        ) ||
                        x.Name.Contains(
                            keyword
                        ) ||
                        x.Area.Contains(
                            keyword
                        )
                    );
            }


            var routes =
                await query
                    .OrderByDescending(x =>
                        x.CreatedAt
                    )
                    .Select(x => new
                    {
                        x.Id,
                        x.RouteCode,
                        x.Name,
                        x.StaffId,
                        x.Area,
                        x.Status,
                        x.PlannedDate,

                        StopCount =
                            x.Stops.Count,

                        PendingStopCount =
                            x.Stops.Count(s =>
                                s.Status ==
                                "pending"
                            ),

                        CompletedStopCount =
                            x.Stops.Count(s =>
                                s.Status ==
                                "completed"
                            ),

                        x.CreatedAt,
                        x.StartedAt,
                        x.CompletedAt
                    })
                    .ToListAsync();


            return Ok(new
            {
                total =
                    routes.Count,

                data =
                    routes
            });
        }


        // =========================================================
        // 3. CHI TIẾT TUYẾN
        // GET /api/v1/operations/routes/{id}
        // =========================================================
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetRouteById(
            int id)
        {
            var route =
                await _context.DeliveryRoutes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            var staff =
                await _context.Staffs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == route.StaffId
                    );


            var stops =
                await _context.RouteStops
                    .AsNoTracking()
                    .Where(x =>
                        x.RouteId == route.Id
                    )
                    .OrderBy(x =>
                        x.StopOrder
                    )
                    .Select(x => new
                    {
                        x.Id,
                        x.ShipmentId,
                        x.StopOrder,
                        x.StopType,
                        x.AddressSnapshot,
                        x.Latitude,
                        x.Longitude,
                        x.Status,
                        x.CompletedAt,
                        x.Notes
                    })
                    .ToListAsync();


            return Ok(new
            {
                route.Id,
                route.RouteCode,
                route.Name,

                staff = staff == null
                    ? null
                    : new
                    {
                        staff.Id,
                        staff.EmployeeCode,
                        staff.Area,
                        staff.Status,
                        staff.IsAvailable
                    },

                route.Area,
                route.Status,
                route.PlannedDate,
                route.Notes,
                route.CreatedByUserId,
                route.CreatedAt,
                route.StartedAt,
                route.CompletedAt,

                stopCount =
                    stops.Count,

                stops
            });
        }


        // =========================================================
        // 4. CẬP NHẬT TUYẾN
        //
        // Chỉ route draft mới được sửa.
        //
        // PATCH /api/v1/operations/routes/{id}
        // =========================================================
        [HttpPatch("{id:int}")]
        public async Task<IActionResult> UpdateRoute(
            int id,
            [FromBody] UpdateDeliveryRouteRequest request)
        {
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status != "draft")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến đang ở trạng thái draft mới được chỉnh sửa."
                });
            }


            // Nếu đổi staff
            if (request.StaffId.HasValue)
            {
                var staff =
                    await _context.Staffs
                        .AsNoTracking()
                        .FirstOrDefaultAsync(x =>
                            x.Id ==
                            request.StaffId.Value
                        );

                if (staff == null)
                {
                    return NotFound(new
                    {
                        message =
                            "Không tìm thấy nhân viên giao hàng."
                    });
                }


                if (staff.Status == "inactive")
                {
                    return BadRequest(new
                    {
                        message =
                            "Nhân viên đang inactive, không thể phân công tuyến."
                    });
                }


                route.StaffId =
                    request.StaffId.Value;
            }


            if (!string.IsNullOrWhiteSpace(
                    request.Name))
            {
                route.Name =
                    request.Name.Trim();
            }


            if (request.Area != null)
            {
                route.Area =
                    request.Area.Trim();
            }


            if (request.PlannedDate.HasValue)
            {
                route.PlannedDate =
                    request.PlannedDate.Value;
            }


            if (request.Notes != null)
            {
                route.Notes =
                    request.Notes.Trim();
            }


            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Cập nhật tuyến giao hàng thành công.",

                route.Id,
                route.RouteCode,
                route.Name,
                route.StaffId,
                route.Area,
                route.Status,
                route.PlannedDate,
                route.Notes
            });
        }


        // =========================================================
        // 5. THÊM SHIPMENT VÀO TUYẾN
        //
        // POST /api/v1/operations/routes/{id}/stops
        // =========================================================
        [HttpPost("{id:int}/stops")]
        public async Task<IActionResult> AddStop(
    int id,
    [FromBody] AddRouteStopRequest request)
        {
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status != "draft")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến draft mới được thêm điểm dừng."
                });
            }


            var shipment =
                await _context.Shipments
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == request.ShipmentId
                    );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy đơn hàng."
                });
            }


            var stopType =
                request.StopType
                    .Trim()
                    .ToLowerInvariant();


            if (stopType != "pickup" &&
                stopType != "delivery")
            {
                return BadRequest(new
                {
                    message =
                        "StopType chỉ được là pickup hoặc delivery."
                });
            }


            // =====================================================
            // KHÔNG CHO CÙNG SHIPMENT + STOPTYPE BỊ LẶP
            //
            // Một shipment được phép có:
            // - 1 pickup stop
            // - 1 delivery stop
            //
            // Nhưng không được có:
            // - pickup 2 lần
            // - delivery 2 lần
            // =====================================================
            var stopAlreadyExists =
                await _context.RouteStops
                    .AnyAsync(x =>
                        x.RouteId == route.Id &&
                        x.ShipmentId == shipment.Id &&
                        x.StopType == stopType
                    );

            if (stopAlreadyExists)
            {
                return Conflict(new
                {
                    message =
                        $"Đơn hàng này đã có điểm {stopType} trong tuyến."
                });
            }


            // =====================================================
            // STOP ORDER KHÔNG ĐƯỢC TRÙNG
            // =====================================================
            var stopOrderExists =
                await _context.RouteStops
                    .AnyAsync(x =>
                        x.RouteId == route.Id &&
                        x.StopOrder ==
                        request.StopOrder
                    );

            if (stopOrderExists)
            {
                return Conflict(new
                {
                    message =
                        $"Thứ tự điểm dừng {request.StopOrder} đã tồn tại."
                });
            }


            // =====================================================
            // LẤY ĐỊA CHỈ + TỌA ĐỘ TỪ SHIPMENT
            // =====================================================
            string addressSnapshot;

            double? latitude;

            double? longitude;


            if (stopType == "pickup")
            {
                addressSnapshot =
                    shipment.PickupAddress;

                latitude =
                    shipment.PickupLatitude;

                longitude =
                    shipment.PickupLongitude;
            }
            else
            {
                addressSnapshot =
                    shipment.DeliveryAddress;

                latitude =
                    shipment.DeliveryLatitude;

                longitude =
                    shipment.DeliveryLongitude;
            }


            // =====================================================
            // TẠO ROUTE STOP
            // =====================================================
            var stop =
                new RouteStop
                {
                    RouteId =
                        route.Id,

                    ShipmentId =
                        shipment.Id,

                    StopOrder =
                        request.StopOrder,

                    StopType =
                        stopType,

                    AddressSnapshot =
                        addressSnapshot,

                    Latitude =
                        latitude,

                    Longitude =
                        longitude,

                    Status =
                        "pending",

                    Notes =
                        request.Notes?.Trim()
                };


            _context.RouteStops.Add(stop);


            await _context.SaveChangesAsync();


            // =====================================================
            // RESPONSE
            // =====================================================
            return Ok(new
            {
                message =
                    "Thêm đơn hàng vào tuyến thành công.",

                stop.Id,
                stop.RouteId,
                stop.ShipmentId,
                stop.StopOrder,
                stop.StopType,
                stop.AddressSnapshot,

                stop.Latitude,
                stop.Longitude,

                stop.Status,
                stop.Notes
            });
        }


        // =========================================================
        // 6. XÓA ĐIỂM DỪNG KHỎI TUYẾN
        //
        // DELETE /api/v1/operations/routes/{id}/stops/{stopId}
        // =========================================================
        [HttpDelete("{id:int}/stops/{stopId:int}")]
        public async Task<IActionResult> RemoveStop(
            int id,
            int stopId)
        {
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status != "draft")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến draft mới được xóa điểm dừng."
                });
            }


            var stop =
                await _context.RouteStops
                    .FirstOrDefaultAsync(x =>
                        x.Id == stopId &&
                        x.RouteId == id
                    );

            if (stop == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy điểm dừng trong tuyến."
                });
            }


            _context.RouteStops.Remove(stop);

            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Xóa điểm dừng khỏi tuyến thành công."
            });
        }

        // =========================================================
        // 7. ĐỔI THỨ TỰ ĐIỂM DỪNG
        //
        // PATCH /api/v1/operations/routes/{id}/stops/reorder
        // =========================================================
        [HttpPatch("{id:int}/stops/reorder")]
        public async Task<IActionResult> ReorderStops(
            int id,
            [FromBody] ReorderRouteStopsRequest request)
        {
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status != "draft")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến draft mới được thay đổi thứ tự."
                });
            }


            // Không cho StopOrder bị trùng trong request
            var duplicateOrder =
                request.Stops
                    .GroupBy(x =>
                        x.StopOrder
                    )
                    .Any(g =>
                        g.Count() > 1
                    );

            if (duplicateOrder)
            {
                return BadRequest(new
                {
                    message =
                        "StopOrder không được trùng nhau."
                });
            }


            var stopIds =
                request.Stops
                    .Select(x => x.StopId)
                    .ToList();


            var stops =
                await _context.RouteStops
                    .Where(x =>
                        x.RouteId == id &&
                        stopIds.Contains(x.Id)
                    )
                    .ToListAsync();


            if (stops.Count !=
                request.Stops.Count)
            {
                return BadRequest(new
                {
                    message =
                        "Có StopId không thuộc tuyến này."
                });
            }


            // =====================================================
            // GIAI ĐOẠN 1
            // Đưa các order sang số âm tạm thời
            // để tránh unique conflict
            // =====================================================
            foreach (var stop in stops)
            {
                stop.StopOrder =
                    -stop.Id;
            }


            await _context.SaveChangesAsync();


            // =====================================================
            // GIAI ĐOẠN 2
            // Gán order mới
            // =====================================================
            foreach (var item in request.Stops)
            {
                var stop =
                    stops.First(x =>
                        x.Id == item.StopId
                    );

                stop.StopOrder =
                    item.StopOrder;
            }


            await _context.SaveChangesAsync();


            var result =
                stops
                    .OrderBy(x =>
                        x.StopOrder
                    )
                    .Select(x => new
                    {
                        x.Id,
                        x.ShipmentId,
                        x.StopOrder,
                        x.StopType,
                        x.AddressSnapshot
                    })
                    .ToList();


            return Ok(new
            {
                message =
                    "Cập nhật thứ tự điểm dừng thành công.",

                stops =
                    result
            });
        }


        // =========================================================
        // 8. KÍCH HOẠT TUYẾN GIAO HÀNG
        //
        // PATCH /api/v1/operations/routes/{id}/activate
        //
        // Khi activate:
        // - Route phải là draft
        // - Phải có ít nhất 1 stop
        // - Staff phải tồn tại và không inactive
        // - Shipment phải đang pending_pickup hoặc pickup_failed
        // - Tự tạo DeliveryAssignment cho staff
        // - Route chuyển thành active
        // =========================================================
        [HttpPatch("{id:int}/activate")]
        public async Task<IActionResult> ActivateRoute(
            int id)
        {
            var userIdText =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    userIdText,
                    out var operationsUserId))
            {
                return Unauthorized(new
                {
                    message = "Token không hợp lệ."
                });
            }


            // =====================================================
            // 1. TÌM ROUTE
            // =====================================================
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status != "draft")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến draft mới được kích hoạt."
                });
            }


            // =====================================================
            // 2. KIỂM TRA STAFF
            // =====================================================
            var staff =
                await _context.Staffs
                    .FirstOrDefaultAsync(x =>
                        x.Id == route.StaffId
                    );

            if (staff == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy nhân viên giao hàng của tuyến."
                });
            }


            if (staff.Status == "inactive")
            {
                return BadRequest(new
                {
                    message =
                        "Nhân viên đang inactive, không thể kích hoạt tuyến."
                });
            }


            // =====================================================
            // 3. LẤY DANH SÁCH STOP
            // =====================================================
            var stops =
                await _context.RouteStops
                    .Where(x =>
                        x.RouteId == route.Id
                    )
                    .OrderBy(x =>
                        x.StopOrder
                    )
                    .ToListAsync();


            if (stops.Count == 0)
            {
                return BadRequest(new
                {
                    message =
                        "Tuyến chưa có điểm dừng nào."
                });
            }


            // =====================================================
            // 4. LẤY SHIPMENT
            // =====================================================
            var shipmentIds =
                stops
                    .Select(x =>
                        x.ShipmentId
                    )
                    .Distinct()
                    .ToList();


            var shipments =
                await _context.Shipments
                    .Where(x =>
                        shipmentIds.Contains(x.Id)
                    )
                    .ToListAsync();


            if (shipments.Count != shipmentIds.Count)
            {
                return BadRequest(new
                {
                    message =
                        "Có đơn hàng trong tuyến không còn tồn tại."
                });
            }


            // =====================================================
            // 5. KIỂM TRA TRẠNG THÁI SHIPMENT
            //
            // Giữ giống rule assign hiện tại của hệ thống:
            // pending_pickup / pickup_failed
            // =====================================================
            // A multi-order route serves standard/fast parcels; express must
            // be direct. One express parcel may have pickup + delivery stops.
            if (shipments.Any(x => x.Service == "express") && shipmentIds.Count > 1)
            {
                return BadRequest(new
                {
                    message = "Hỏa tốc phải giao trực tiếp. Không được gom nhiều đơn vào cùng tuyến có đơn hỏa tốc."
                });
            }

            // Route activation must not bypass the existing payment requirement.
            var prepaidIds = shipments
                .Where(x => x.FeePayer == "shop_prepaid")
                .Select(x => x.Id)
                .ToList();

            if (prepaidIds.Count > 0)
            {
                var paidShipmentIds = await _context.Payments.AsNoTracking()
                    .Where(x => prepaidIds.Contains(x.ShipmentId) && x.Status == "paid")
                    .Select(x => x.ShipmentId)
                    .Distinct()
                    .ToListAsync();

                var unpaid = prepaidIds.Except(paidShipmentIds).ToList();
                if (unpaid.Count > 0)
                {
                    return Conflict(new
                    {
                        message = "Đơn shop_prepaid cần thanh toán trước khi đưa vào tuyến.",
                        shipmentIds = unpaid
                    });
                }
            }

            // A regular delivery route follows StaffAreas defined by Operations.
            // Preserve older orders without DeliveryAreaId for compatibility.
            var coveredAreaIds = await _context.StaffAreas.AsNoTracking()
                .Where(x => x.StaffId == route.StaffId && x.IsActive && x.Area.IsActive)
                .Select(x => x.AreaId)
                .ToListAsync();

            var outsideCoverage = shipments
                .Where(x => x.Service != "express" &&
                            x.DeliveryAreaId.HasValue &&
                            !coveredAreaIds.Contains(x.DeliveryAreaId.Value))
                .Select(x => x.Id)
                .ToList();
            if (outsideCoverage.Count > 0)
            {
                return BadRequest(new
                {
                    message = "Tuyến tiêu chuẩn/nhanh chứa đơn ngoài khu vực Staff phụ trách.",
                    shipmentIds = outsideCoverage
                });
            }

            var invalidShipments =
                shipments
                    .Where(x =>
                        x.Status != "pending_pickup" &&
                        x.Status != "pickup_failed"
                    )
                    .Select(x => new
                    {
                        x.Id,
                        x.Status
                    })
                    .ToList();


            if (invalidShipments.Count > 0)
            {
                return BadRequest(new
                {
                    message =
                        "Có đơn hàng không thể phân công vào tuyến.",

                    invalidShipments
                });
            }


            // =====================================================
            // 6. KIỂM TRA ACTIVE ASSIGNMENT
            // =====================================================
            var activeAssignments =
                await _context.DeliveryAssignments
                    .Where(x =>
                        shipmentIds.Contains(
                            x.ShipmentId
                        ) &&
                        x.IsActive
                    )
                    .ToListAsync();


            // Nếu đơn đang được staff KHÁC phụ trách
            var conflictingAssignments =
                activeAssignments
                    .Where(x =>
                        x.StaffId != route.StaffId
                    )
                    .Select(x => new
                    {
                        x.ShipmentId,
                        x.StaffId
                    })
                    .ToList();


            if (conflictingAssignments.Count > 0)
            {
                return Conflict(new
                {
                    message =
                        "Có đơn hàng đang được nhân viên khác phụ trách.",

                    conflictingAssignments
                });
            }


            // =====================================================
            // 7. TẠO DELIVERY ASSIGNMENT
            //
            // Nếu shipment đã active assignment cho đúng staff này
            // thì không tạo duplicate.
            // =====================================================
            foreach (var shipment in shipments)
            {
                var alreadyAssignedToThisStaff =
                    activeAssignments.Any(x =>
                        x.ShipmentId ==
                            shipment.Id &&
                        x.StaffId ==
                            route.StaffId
                    );


                if (alreadyAssignedToThisStaff)
                {
                    continue;
                }


                var assignment =
                    new DeliveryAssignment
                    {
                        ShipmentId =
                            shipment.Id,

                        StaffId =
                            route.StaffId,

                        AssignedByUserId =
                            operationsUserId,

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
            }


            // =====================================================
            // 8. ACTIVATE ROUTE
            // =====================================================
            route.Status =
                "active";

            route.StartedAt =
                DateTime.UtcNow;


            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Kích hoạt tuyến giao hàng thành công.",

                route.Id,
                route.RouteCode,
                route.Name,
                route.StaffId,
                staff.EmployeeCode,

                route.Status,
                route.StartedAt,

                shipmentCount =
                    shipments.Count,

                shipments =
                    shipments.Select(x => new
                    {
                        x.Id,
                        x.Status
                    })
            });
        }


        // =========================================================
        // 9. HOÀN THÀNH TUYẾN
        //
        // PATCH /api/v1/operations/routes/{id}/complete
        //
        // Điều kiện:
        // - Route phải active
        // - Tất cả shipment phải ở trạng thái cuối:
        //      delivered
        //      returned
        // =========================================================
        [HttpPatch("{id:int}/complete")]
        public async Task<IActionResult> CompleteRoute(
            int id)
        {
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status != "active")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến đang active mới có thể hoàn thành."
                });
            }


            var stops =
                await _context.RouteStops
                    .Where(x =>
                        x.RouteId == route.Id
                    )
                    .ToListAsync();


            if (stops.Count == 0)
            {
                return BadRequest(new
                {
                    message =
                        "Tuyến không có điểm dừng."
                });
            }


            var shipmentIds =
                stops
                    .Select(x => x.ShipmentId)
                    .Distinct()
                    .ToList();


            var shipments =
                await _context.Shipments
                    .Where(x =>
                        shipmentIds.Contains(x.Id)
                    )
                    .ToListAsync();


            // Các đơn chưa ở trạng thái cuối
            var unfinishedShipments =
                shipments
                    .Where(x =>
                        x.Status != "delivered" &&
                        x.Status != "returned"
                    )
                    .Select(x => new
                    {
                        x.Id,
                        x.Status
                    })
                    .ToList();


            if (unfinishedShipments.Count > 0)
            {
                return BadRequest(new
                {
                    message =
                        "Tuyến vẫn còn đơn hàng chưa hoàn tất.",

                    unfinishedShipments
                });
            }


            // Đánh dấu các stop đã hoàn tất
            foreach (var stop in stops)
            {
                stop.Status =
                    "completed";

                stop.CompletedAt ??=
                    DateTime.UtcNow;
            }


            route.Status =
                "completed";

            route.CompletedAt =
                DateTime.UtcNow;


            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Hoàn thành tuyến giao hàng thành công.",

                route.Id,
                route.RouteCode,
                route.Status,
                route.StartedAt,
                route.CompletedAt,

                shipmentCount =
                    shipmentIds.Count
            });
        }


        // =========================================================
        // 10. HỦY TUYẾN
        //
        // PATCH /api/v1/operations/routes/{id}/cancel
        //
        // Chỉ cho hủy khi route vẫn còn draft.
        // =========================================================
        [HttpPatch("{id:int}/cancel")]
        public async Task<IActionResult> CancelRoute(
            int id)
        {
            var route =
                await _context.DeliveryRoutes
                    .FirstOrDefaultAsync(x =>
                        x.Id == id
                    );

            if (route == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy tuyến giao hàng."
                });
            }


            if (route.Status == "cancelled")
            {
                return Conflict(new
                {
                    message =
                        "Tuyến này đã được hủy trước đó."
                });
            }


            if (route.Status != "draft")
            {
                return BadRequest(new
                {
                    message =
                        "Chỉ tuyến draft mới được hủy."
                });
            }


            route.Status =
                "cancelled";


            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Hủy tuyến giao hàng thành công.",

                route.Id,
                route.RouteCode,
                route.Name,
                route.Status
            });
        }
    }
}