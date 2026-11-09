using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs.Customer;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers.Customer;

[ApiController]
[Route("api/v1")]
public class OrderController : ControllerBase
{
    private readonly AppDbContext _db;


    public OrderController(AppDbContext db)
    {
        _db = db;
    }


    // =========================================================
    // BÁO GIÁ VẬN CHUYỂN
    // POST /api/v1/shipping-quotes
    // =========================================================
    [HttpPost("shipping-quotes")]
    public async Task<IActionResult> Quote(
        [FromBody] ShipmentInput input)
    {
        var error =
            Validate(input);

        if (error != null)
        {
            return BadRequest(new
            {
                message = error
            });
        }


        var (fee, chargeableKg) =
            CalculateFee(input);


        if (input.FeePayer == "deduct_cod")
        {
            if (input.CodAmount <= 0)
            {
                return BadRequest(new
                {
                    message =
                        "Đơn chọn trừ phí từ COD phải có tiền COD lớn hơn 0."
                });
            }


            if (input.CodAmount < fee)
            {
                return BadRequest(new
                {
                    message =
                        "COD không đủ để khấu trừ phí vận chuyển."
                });
            }
        }


        var quote =
    new ShippingQuote
    {
        Id =
            $"Q-{Guid.NewGuid():N}"
                .ToUpperInvariant(),

        InputHash =
            Hash(input),

        Fee =
            fee,

        PickupLatitude =
            input.PickupLatitude,

        PickupLongitude =
            input.PickupLongitude,

        DeliveryLatitude =
            input.DeliveryLatitude,

        DeliveryLongitude =
            input.DeliveryLongitude,

        ExpiresAt =
            DateTime.UtcNow
                .AddMinutes(5),

        Used =
            false
    };


        _db.ShippingQuotes.Add(
            quote
        );


        await _db.SaveChangesAsync();


        return Ok(new
        {
            id =
        quote.Id,

            fee =
        quote.Fee,

            expiresAt =
        quote.ExpiresAt,

            chargeableWeightKg =
        chargeableKg,

            pickupLatitude =
        quote.PickupLatitude,

            pickupLongitude =
        quote.PickupLongitude,

            deliveryLatitude =
        quote.DeliveryLatitude,

            deliveryLongitude =
        quote.DeliveryLongitude
        });
    }


    // =========================================================
    // TẠO SHIPMENT
    // POST /api/v1/shipments
    // =========================================================
    [HttpPost("shipments")]
    [Authorize(Roles = "customer")]
    public async Task<IActionResult> Create(
        [FromBody] CreateShipmentRequest request)
    {
        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập để tạo đơn hàng."
            });
        }


        if (currentUser.Role != "customer")
        {
            return Forbid();
        }


        var error =
            Validate(request);


        if (error != null)
        {
            return BadRequest(new
            {
                message = error
            });
        }


        var quote =
            await _db.ShippingQuotes
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        request.QuoteId
                );


        if (quote == null ||
            quote.Used ||
            quote.ExpiresAt <= DateTime.UtcNow ||
            quote.InputHash != Hash(request))
        {
            return Conflict(new
            {
                message =
                    "Báo giá hết hạn hoặc thông tin đơn hàng đã thay đổi. Hãy tính lại phí."
            });
        }


        if (request.FeePayer == "deduct_cod")
        {
            if (request.CodAmount <= 0)
            {
                return BadRequest(new
                {
                    message =
                        "Đơn chọn trừ phí từ COD phải có tiền COD lớn hơn 0."
                });
            }


            if (request.CodAmount <
                quote.Fee)
            {
                return BadRequest(new
                {
                    message =
                        "COD không đủ để khấu trừ phí vận chuyển."
                });
            }
        }


        var now =
            DateTime.UtcNow;


        var shipment =
            new Shipment
            {
                Id =
                    $"EXP-{Guid.NewGuid():N}"
                        .ToUpperInvariant(),

                CustomerId =
                    currentUser.Id,

                SenderName =
                    request.SenderName.Trim(),

                SenderPhone =
                    request.SenderPhone.Trim(),

                PickupAddress =
                    request.PickupAddress.Trim(),

                PickupLatitude =
                    quote.PickupLatitude,

                PickupLongitude =
                    quote.PickupLongitude,

                RecipientName =
                    request.RecipientName.Trim(),

                RecipientPhone =
                    request.RecipientPhone.Trim(),

                DeliveryAddress =
                    request.DeliveryAddress.Trim(),

                DeliveryLatitude =
                    quote.DeliveryLatitude,

                DeliveryLongitude =
                    quote.DeliveryLongitude,

                Goods =
                    request.Goods.Trim(),

                WeightKg =
                    request.WeightKg,

                LengthCm =
                    request.LengthCm,

                WidthCm =
                    request.WidthCm,

                HeightCm =
                    request.HeightCm,

                DeclaredValue =
                    request.DeclaredValue,

                CodAmount =
                    request.CodAmount,

                VehicleType =
                    request.VehicleType
                        .Trim()
                        .ToLowerInvariant(),

                Service =
                    request.Service
                        .Trim()
                        .ToLowerInvariant(),

                FeePayer =
                    request.FeePayer
                        .Trim()
                        .ToLowerInvariant(),

                Notes =
                    request.Notes?
                        .Trim()
                    ?? string.Empty,

                Fee =
                    quote.Fee,

                Status =
                    "pending_pickup",

                Attempts =
                    0,

                CodCollected =
                    0,

                CreatedAt =
                    now,

                Events =
                    new List<ShipmentEvent>
                    {
                        new()
                        {
                            Status =
                                "pending_pickup",

                            At =
                                now,

                            Note =
                                "Đã xác nhận yêu cầu giao hàng."
                        }
                    }
            };


        quote.Used =
            true;


        _db.Shipments.Add(
            shipment
        );


        await _db.SaveChangesAsync();


        return Ok(
            await BuildShipmentResponse(
                shipment.Id
            )
        );
    }


    // =========================================================
    // DANH SÁCH SHIPMENT
    // GET /api/v1/shipments
    // =========================================================
    [HttpGet("shipments")]
    [Authorize(
        Roles =
            "customer,staff,operations"
    )]
    public async Task<IActionResult> List()
    {
        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập để xem danh sách đơn hàng."
            });
        }


        IQueryable<Shipment> query =
            _db.Shipments
                .Include(x => x.Events)
                .AsNoTracking();


        if (currentUser.Role ==
            "customer")
        {
            query =
                query.Where(
                    x =>
                        x.CustomerId ==
                        currentUser.Id
                );
        }
        else if (!IsStaffOrOperations(
                     currentUser))
        {
            return Forbid();
        }


        var shipments =
            await query
                .OrderByDescending(
                    x => x.CreatedAt
                )
                .ToListAsync();


        return Ok(
            shipments.Select(
                ToResponse
            )
        );
    }


    // =========================================================
    // CHI TIẾT SHIPMENT
    // GET /api/v1/shipments/{shipmentId}
    // =========================================================
    [HttpGet("shipments/{shipmentId}")]
    [Authorize(
        Roles =
            "customer,staff,operations"
    )]
    public async Task<IActionResult> Get(
        string shipmentId)
    {
        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập."
            });
        }


        var shipment =
            await _db.Shipments
                .Include(x => x.Events)
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        shipmentId
                );


        if (shipment == null)
        {
            return NotFound(new
            {
                message =
                    "Không tìm thấy vận đơn."
            });
        }


        if (currentUser.Role ==
                "customer" &&
            shipment.CustomerId !=
                currentUser.Id)
        {
            return Forbid();
        }


        if (currentUser.Role !=
                "customer" &&
            !IsStaffOrOperations(
                currentUser))
        {
            return Forbid();
        }


        return Ok(
            ToResponse(shipment)
        );
    }


    // =========================================================
    // OPERATIONS MANUAL TRANSITION
    // POST /api/v1/shipments/{shipmentId}/events
    //
    // Staff hiện dùng StaffController.
    // Endpoint này giữ lại cho Operations/manual flow cũ.
    // =========================================================
    [HttpPost(
        "shipments/{shipmentId}/events"
    )]
    [Authorize(Roles = "operations")]
    public async Task<IActionResult> Transition(
        string shipmentId,
        [FromBody] TransitionRequest request)
    {
        var shipment =
            await _db.Shipments
                .Include(x => x.Events)
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        shipmentId
                );


        if (shipment == null)
        {
            return NotFound(new
            {
                message =
                    "Không tìm thấy đơn hàng."
            });
        }


        var allowed =
            new Dictionary<
                string,
                string[]
            >
            {
                ["pending_pickup"] =
                    new[]
                    {
                        "picking_up",
                        "pickup_failed",
                        "picked_up"
                    },

                ["picking_up"] =
                    new[]
                    {
                        "pickup_failed",
                        "picked_up"
                    },

                ["pickup_failed"] =
                    new[]
                    {
                        "picking_up",
                        "pending_pickup",
                        "picked_up"
                    },

                ["picked_up"] =
                    new[]
                    {
                        "in_transit",
                        "at_hub",
                        "out_for_delivery",
                        "delivering"
                    },

                ["in_transit"] =
                    new[]
                    {
                        "at_hub",
                        "out_for_delivery",
                        "delivering"
                    },

                ["at_hub"] =
                    new[]
                    {
                        "in_transit",
                        "out_for_delivery",
                        "delivering"
                    },

                ["out_for_delivery"] =
                    new[]
                    {
                        "delivery_failed",
                        "delivered"
                    },

                ["delivering"] =
                    new[]
                    {
                        "delivery_failed",
                        "delivered"
                    },

                ["delivery_failed"] =
                    new[]
                    {
                        "out_for_delivery",
                        "delivering",
                        "return_pending",
                        "returning"
                    },

                ["return_pending"] =
                    new[]
                    {
                        "returning"
                    },

                ["returning"] =
                    new[]
                    {
                        "returned"
                    },

                ["returned"] =
                    new[]
                    {
                        "return_confirmed"
                    },

                ["delivered"] =
                    Array.Empty<string>(),

                ["return_confirmed"] =
                    Array.Empty<string>()
            };


        if (!allowed.TryGetValue(
                shipment.Status,
                out var next) ||
            !next.Contains(
                request.Status))
        {
            return Conflict(new
            {
                message =
                    "Chuyển trạng thái không hợp lệ."
            });
        }


        if (new[]
            {
                "pickup_failed",
                "delivery_failed",
                "returning"
            }
            .Contains(request.Status) &&
            string.IsNullOrWhiteSpace(
                request.Note))
        {
            return BadRequest(new
            {
                message =
                    "Vui lòng nhập lý do."
            });
        }


        if (request.Status is
            "out_for_delivery" or
            "delivering")
        {
            var deliveryFailures =
                shipment.Events.Count(
                    x =>
                        x.Status ==
                        "delivery_failed"
                );


            if (deliveryFailures >= 3)
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng đã đạt giới hạn 3 lần giao. Vui lòng chuyển hoàn."
                });
            }
        }


        if (request.Status ==
                "delivered" &&
            shipment.CodAmount > 0 &&
            request.CodCollected !=
                shipment.CodAmount)
        {
            return BadRequest(new
            {
                message =
                    "Cần xác nhận đã thu đủ tiền COD."
            });
        }


        shipment.Status =
            request.Status;


        if (request.Status ==
            "pickup_failed")
        {
            shipment.Attempts++;
        }


        if (request.Status ==
            "delivery_failed")
        {
            shipment.Attempts++;
        }


        if (request.Status ==
            "delivered")
        {
            shipment.CodCollected =
                shipment.CodAmount;
        }


        if (request.Status ==
            "returned")
        {
            shipment.CodCollected =
                0;
        }


        if (request.Status !=
            "at_hub")
        {
            shipment.CurrentHubId =
                null;
        }


        shipment.Events.Add(
            new ShipmentEvent
            {
                ShipmentId =
                    shipment.Id,

                Status =
                    shipment.Status,

                At =
                    DateTime.UtcNow,

                Note =
                    request.Note?
                        .Trim()
                    ?? string.Empty
            }
        );


        await _db.SaveChangesAsync();


        return Ok(
            ToResponse(shipment)
        );
    }


    // =========================================================
    // ĐIỂM LẤY HÀNG
    // GET /api/v1/pickup-locations
    // =========================================================
    [HttpGet("pickup-locations")]
    [Authorize(Roles = "customer")]
    public async Task<IActionResult>
        PickupLocations()
    {
        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập."
            });
        }


        if (currentUser.Role !=
            "customer")
        {
            return Forbid();
        }


        var locations =
            await _db.PickupLocations
                .AsNoTracking()
                .Where(
                    x =>
                        x.CustomerId ==
                        currentUser.Id
                )
                .OrderBy(
                    x => x.Name
                )
                .ToListAsync();


        return Ok(locations);
    }


    // =========================================================
    // TẠO ĐIỂM LẤY HÀNG
    // POST /api/v1/pickup-locations
    // =========================================================
    [HttpPost("pickup-locations")]
    [Authorize(Roles = "customer")]
    public async Task<IActionResult>
        CreatePickupLocation(
            [FromBody]
            CreatePickupLocationRequest request)
    {
        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập."
            });
        }


        if (currentUser.Role !=
            "customer")
        {
            return Forbid();
        }


        var customerId =
            currentUser.Id;


        var exists =
            await _db.PickupLocations
                .AnyAsync(x =>
                    x.Name ==
                        request.Name.Trim() &&
                    x.CustomerId ==
                        customerId
                );


        if (exists)
        {
            return Conflict(new
            {
                message =
                    "Tên điểm lấy hàng đã tồn tại."
            });
        }


        var location =
            new PickupLocation
            {
                CustomerId =
                    customerId,

                Name =
                    request.Name.Trim(),

                ContactName =
                    request.ContactName.Trim(),

                ContactPhone =
                    request.ContactPhone.Trim(),

                Address =
                    request.Address.Trim()
            };


        _db.PickupLocations.Add(
            location
        );


        await _db.SaveChangesAsync();


        return StatusCode(
            StatusCodes.Status201Created,
            location
        );
    }


    // =========================================================
    // LỊCH SỬ KHIẾU NẠI CỦA SHIPMENT
    // GET /api/v1/shipments/{shipmentId}/complaints
    // =========================================================
    [HttpGet(
        "shipments/{shipmentId}/complaints"
    )]
    [Authorize(
        Roles =
            "customer,staff,operations"
    )]
    public async Task<IActionResult>
        GetComplaints(
            string shipmentId)
    {
        var shipment =
            await _db.Shipments
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        shipmentId
                );


        if (shipment == null)
        {
            return NotFound(new
            {
                message =
                    "Không tìm thấy đơn hàng."
            });
        }


        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập."
            });
        }


        if (currentUser.Role ==
                "customer" &&
            shipment.CustomerId !=
                currentUser.Id)
        {
            return Forbid();
        }


        if (currentUser.Role !=
                "customer" &&
            !IsStaffOrOperations(
                currentUser))
        {
            return Forbid();
        }


        var complaints =
            await _db.Complaints
                .AsNoTracking()
                .Where(
                    x =>
                        x.ShipmentId ==
                        shipmentId &&
                        (currentUser.Role !=
                            "customer" ||
                         x.Source ==
                            "customer") &&
                        (currentUser.Role !=
                            "staff" ||
                         x.Source ==
                            "staff")
                )
                .OrderByDescending(
                    x => x.CreatedAt
                )
                .Select(x => new
                {
                    x.Id,
                    x.ShipmentId,
                    x.Source,
                    x.Type,
                    x.Category,
                    x.Content,
                    x.Status,
                    x.Response,
                    x.CreatedAt,
                    x.ResolvedAt
                })
                .ToListAsync();


        return Ok(complaints);
    }


    // =========================================================
    // CUSTOMER TẠO KHIẾU NẠI
    // POST /api/v1/shipments/{shipmentId}/complaints
    // =========================================================
    [HttpPost(
        "shipments/{shipmentId}/complaints"
    )]
    [Authorize(Roles = "customer")]
    public async Task<IActionResult>
        CreateComplaint(
            string shipmentId,
            [FromBody]
            CreateComplaintRequest request)
    {
        var shipment =
            await _db.Shipments
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        shipmentId
                );


        if (shipment == null)
        {
            return NotFound(new
            {
                message =
                    "Không tìm thấy đơn hàng."
            });
        }


        var currentUser =
            await GetCurrentUserAsync();


        if (currentUser == null)
        {
            return Unauthorized(new
            {
                message =
                    "Vui lòng đăng nhập."
            });
        }


        if (currentUser.Role !=
            "customer")
        {
            return Forbid();
        }


        if (shipment.CustomerId !=
            currentUser.Id)
        {
            return Forbid();
        }


        var allowedTypes =
            new[]
            {
                "damaged",
                "delayed",
                "lost",
                "wrong_item",
                "other"
            };


        var type =
            request.Type
                .Trim()
                .ToLowerInvariant();


        if (!allowedTypes.Contains(
                type))
        {
            return BadRequest(new
            {
                message =
                    "Loại khiếu nại không hợp lệ."
            });
        }


        var content =
            request.Content.Trim();


        if (content.Length < 10)
        {
            return BadRequest(new
            {
                message =
                    "Nội dung khiếu nại phải có ít nhất 10 ký tự."
            });
        }


        if (content.Length > 1000)
        {
            return BadRequest(new
            {
                message =
                    "Nội dung khiếu nại không được vượt quá 1000 ký tự."
            });
        }


        var complaint =
            new Complaint
            {
                ShipmentId =
                    shipment.Id,

                CustomerId =
                    currentUser.Id,

                Source =
                    "customer",

                Type =
                    type,

                Content =
                    content,

                Status =
                    "pending",

                CreatedAt =
                    DateTime.UtcNow,

                History =
                {
                    new ComplaintHistory
                    {
                        Action =
                            "created",

                        ToStatus =
                            "pending",

                        Note =
                            "Khách hàng gửi khiếu nại",

                        ActorUserId =
                            currentUser.Id,

                        ActorRole =
                            "customer",

                        CreatedAt =
                            DateTime.UtcNow
                    }
                }
            };


        _db.Complaints.Add(
            complaint
        );


        await _db.SaveChangesAsync();


        return StatusCode(
            StatusCodes.Status201Created,
            new
            {
                complaint.Id,
                complaint.ShipmentId,
                complaint.Source,
                complaint.Type,
                complaint.Category,
                complaint.Content,
                complaint.Status,
                complaint.Response,
                complaint.CreatedAt,
                complaint.ResolvedAt
            }
        );
    }


    // =========================================================
    // OPERATIONS XEM TẤT CẢ KHIẾU NẠI
    // GET /api/v1/complaints
    // =========================================================
    [HttpGet("complaints")]
    [Authorize(Roles = "operations")]
    public async Task<IActionResult>
        GetAllComplaints(
            [FromQuery] string? source)
    {
        var query =
            _db.Complaints
                .AsNoTracking()
                .AsQueryable();


        if (!string.IsNullOrWhiteSpace(
                source))
        {
            var src =
                source.Trim()
                    .ToLowerInvariant();

            query =
                query.Where(
                    x =>
                        x.Source ==
                        src
                );
        }


        var complaints =
            await query
                .OrderByDescending(
                    x => x.CreatedAt
                )
                .Select(x => new
                {
                    x.Id,
                    x.ShipmentId,
                    x.Source,
                    x.Type,
                    x.Category,
                    x.Content,
                    x.Status,
                    x.Response,
                    x.CreatedAt,
                    x.ResolvedAt
                })
                .ToListAsync();


        return Ok(complaints);
    }


    // =========================================================
    // OPERATIONS CẬP NHẬT KHIẾU NẠI
    // PATCH /api/v1/complaints/{complaintId}
    // =========================================================
    [HttpPatch(
        "complaints/{complaintId:int}"
    )]
    [Authorize(Roles = "operations")]
    public async Task<IActionResult>
        UpdateComplaint(
            int complaintId,
            [FromBody]
            UpdateComplaintRequest request)
    {
        var complaint =
            await _db.Complaints
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        complaintId
                );


        if (complaint == null)
        {
            return NotFound(new
            {
                message =
                    "Không tìm thấy khiếu nại."
            });
        }


        var status =
            request.Status
                .Trim()
                .ToLowerInvariant();


        if (status != "processing" &&
            status != "resolved")
        {
            return BadRequest(new
            {
                message =
                    "Trạng thái xử lý không hợp lệ."
            });
        }


        if (complaint.Status ==
                "pending" &&
            status != "processing")
        {
            return Conflict(new
            {
                message =
                    "Báo cáo phải được bắt đầu xử lý trước."
            });
        }


        if (complaint.Status ==
                "processing" &&
            status != "resolved")
        {
            return Conflict(new
            {
                message =
                    "Báo cáo đang xử lý chỉ có thể chuyển sang đã giải quyết."
            });
        }


        if (complaint.Status ==
            "resolved")
        {
            return Conflict(new
            {
                message =
                    "Báo cáo này đã được giải quyết."
            });
        }


        var response =
            request.Response?
                .Trim();


        if (status == "resolved" &&
            string.IsNullOrWhiteSpace(
                response))
        {
            return BadRequest(new
            {
                message =
                    "Vui lòng nhập kết quả giải quyết."
            });
        }


        if (response != null &&
            response.Length > 1000)
        {
            return BadRequest(new
            {
                message =
                    "Kết quả giải quyết không được vượt quá 1000 ký tự."
            });
        }


        var fromStatus =
            complaint.Status;

        var actorId =
            GetCurrentUserId();


        complaint.Status =
            status;

        complaint.HandledByUserId =
            actorId;

        complaint.UpdatedAt =
            DateTime.UtcNow;


        if (status ==
            "processing")
        {
            complaint.Response =
                null;

            complaint.ResolvedAt =
                null;
        }


        if (status ==
            "resolved")
        {
            complaint.Response =
                response;

            complaint.ResolvedAt =
                DateTime.UtcNow;
        }


        // Lưu lịch sử xử lý (ghi chú không bị mất khi đổi trạng thái)
        _db.ComplaintHistories.Add(
            new ComplaintHistory
            {
                ComplaintId =
                    complaint.Id,

                Action =
                    status,

                FromStatus =
                    fromStatus,

                ToStatus =
                    status,

                Note =
                    response,

                ActorUserId =
                    actorId,

                ActorRole =
                    "operations",

                CreatedAt =
                    DateTime.UtcNow
            }
        );


        await _db.SaveChangesAsync();


        return Ok(new
        {
            complaint.Id,
            complaint.ShipmentId,
            complaint.Source,
            complaint.Type,
            complaint.Category,
            complaint.Content,
            complaint.Status,
            complaint.Response,
            complaint.CreatedAt,
            complaint.ResolvedAt
        });
    }


    // =========================================================
    // JWT USER
    // =========================================================
    private int? GetCurrentUserId()
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


    private async Task<User?>
        GetCurrentUserAsync()
    {
        var userId =
            GetCurrentUserId();


        if (userId == null)
        {
            return null;
        }


        return await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x =>
                    x.Id ==
                    userId.Value
            );
    }


    private static bool
        IsStaffOrOperations(
            User user)
    {
        return user.Role is
            "staff" or
            "operations";
    }


    // =========================================================
    // VALIDATION NGHIỆP VỤ
    // =========================================================
    private static string?
        Validate(
            ShipmentInput input)
    {
        if (new[]
            {
                input.SenderName,
                input.SenderPhone,
                input.PickupAddress,
                input.RecipientName,
                input.RecipientPhone,
                input.DeliveryAddress,
                input.Goods
            }
            .Any(
                string.IsNullOrWhiteSpace
            ))
        {
            return
                "Vui lòng điền đầy đủ thông tin bắt buộc.";
        }


        var phone =
            new System.Text.RegularExpressions.Regex(
                @"^0[0-9]{9}$"
            );


        if (!phone.IsMatch(
                input.SenderPhone.Trim()) ||
            !phone.IsMatch(
                input.RecipientPhone.Trim()))
        {
            return
                "Số điện thoại người gửi/người nhận không hợp lệ.";
        }


        if (input.WeightKg <= 0 ||
            input.LengthCm <= 0 ||
            input.WidthCm <= 0 ||
            input.HeightCm <= 0)
        {
            return
                "Khối lượng và kích thước phải lớn hơn 0.";
        }


        if (input.DeclaredValue < 0 ||
            input.CodAmount < 0)
        {
            return
                "Giá trị hàng và COD phải là số nguyên không âm.";
        }


        if (input.VehicleType is not
            ("motorbike" or "car"))
        {
            return
                "Loại phương tiện không hợp lệ.";
        }


        if (input.Service is not
            ("standard" or
             "fast" or
             "express"))
        {
            return
                "Dịch vụ không hợp lệ.";
        }


        if (input.VehicleType ==
                "car" &&
            input.Service ==
                "express")
        {
            return
                "Ô tô hiện chưa hỗ trợ dịch vụ Hỏa tốc.";
        }


        if (input.FeePayer is not
            ("shop_prepaid" or
             "recipient" or
             "deduct_cod"))
        {
            return
                "Hình thức thanh toán phí không hợp lệ.";
        }
        // =====================================================
        // VALIDATE MAP COORDINATES
        // Nếu đã truyền tọa độ thì phải truyền đủ cả 4 giá trị.
        // =====================================================
        var hasAnyCoordinate =
            input.PickupLatitude.HasValue ||
            input.PickupLongitude.HasValue ||
            input.DeliveryLatitude.HasValue ||
            input.DeliveryLongitude.HasValue;

        var hasAllCoordinates =
            input.PickupLatitude.HasValue &&
            input.PickupLongitude.HasValue &&
            input.DeliveryLatitude.HasValue &&
            input.DeliveryLongitude.HasValue;

        if (hasAnyCoordinate &&
            !hasAllCoordinates)
        {
            return
                "Vui lòng chọn đầy đủ vị trí lấy hàng và giao hàng trên bản đồ.";
        }

        return null;
    }


    // =========================================================
    // TÍNH PHÍ
    // =========================================================
    private static (
        long fee,
        decimal chargeableKg)
        CalculateFee(
            ShipmentInput input)
    {
        var baseFee =
            (
                input.VehicleType,
                input.Service
            )
            switch
            {
                (
                    "motorbike",
                    "standard"
                )
                    => 20000L,

                (
                    "motorbike",
                    "fast"
                )
                    => 30000L,

                (
                    "motorbike",
                    "express"
                )
                    => 40000L,

                (
                    "car",
                    "standard"
                )
                    => 50000L,

                (
                    "car",
                    "fast"
                )
                    => 70000L,

                _ =>
                    throw new
                        InvalidOperationException(
                            "Bảng giá không hợp lệ."
                        )
            };


        long weightSurcharge;


        if (input.WeightKg <= 5m)
        {
            weightSurcharge =
                0L;
        }
        else if (input.WeightKg <=
                 10m)
        {
            weightSurcharge =
                10000L;
        }
        else
        {
            var extraKg =
                (int)Math.Ceiling(
                    input.WeightKg -
                    10m
                );


            weightSurcharge =
                checked(
                    10000L +
                    extraKg *
                    2000L
                );
        }


        return (
            checked(
                baseFee +
                weightSurcharge
            ),

            input.WeightKg
        );
    }


    // =========================================================
    // HASH INPUT QUOTE
    // =========================================================
    private static string Hash(
        ShipmentInput input)
    {
        var json =
            JsonSerializer.Serialize(
                new
                {
                    input.SenderName,
                    input.SenderPhone,
                    input.PickupAddress,
                    input.PickupLatitude,
                    input.PickupLongitude,

                    input.RecipientName,
                    input.RecipientPhone,
                    input.DeliveryAddress,
                    input.DeliveryLatitude,
                    input.DeliveryLongitude,

                    input.Goods,

                    input.WeightKg,
                    input.LengthCm,
                    input.WidthCm,
                    input.HeightCm,

                    input.DeclaredValue,
                    input.CodAmount,

                    input.VehicleType,
                    input.Service,
                    input.FeePayer,

                    Notes =
                        input.Notes ??
                        string.Empty
                }
            );


        return Convert.ToHexString(
            SHA256.HashData(
                Encoding.UTF8.GetBytes(
                    json
                )
            )
        );
    }


    // =========================================================
    // RESPONSE
    // =========================================================
    private async Task<object?>
        BuildShipmentResponse(
            string id)
    {
        var shipment =
            await _db.Shipments
                .Include(x => x.Events)
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x =>
                        x.Id ==
                        id
                );


        return shipment == null
            ? null
            : ToResponse(
                shipment
            );
    }


    private static object ToResponse(
        Shipment x)
    {
        return new
        {
            x.Id,
            x.CustomerId,

            x.SenderName,
            x.SenderPhone,

            x.PickupAddress,
            x.PickupLatitude,
            x.PickupLongitude,

            x.RecipientName,
            x.RecipientPhone,

            x.DeliveryAddress,
            x.DeliveryLatitude,
            x.DeliveryLongitude,

            x.Goods,

            x.WeightKg,
            x.LengthCm,
            x.WidthCm,
            x.HeightCm,

            x.DeclaredValue,
            x.CodAmount,

            x.Service,
            x.VehicleType,

            x.FeePayer,

            x.Notes,

            x.CurrentHubId,

            x.Status,

            x.Fee,

            x.Attempts,

            x.CodCollected,

            x.CreatedAt,

            events =
                x.Events
                    .OrderBy(
                        e => e.At
                    )
                    .Select(
                        e => new
                        {
                            e.Status,
                            e.At,
                            e.Note
                        }
                    )
        };
    }
}