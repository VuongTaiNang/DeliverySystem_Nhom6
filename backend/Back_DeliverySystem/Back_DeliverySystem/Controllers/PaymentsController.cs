using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs.Customer;
using Back_DeliverySystem.Models;
using Back_DeliverySystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Back_DeliverySystem.Controllers
{
    [ApiController]
    [Route("api/v1/payments")]
    public class PaymentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IVnPayService _vnPayService;
        private readonly IConfiguration _configuration;
        private readonly IAutoAssignmentService _autoAssignment;
        private readonly ILogger<PaymentsController> _logger;

        public PaymentsController(
            AppDbContext context,
            IVnPayService vnPayService,
            IConfiguration configuration,
            IAutoAssignmentService autoAssignment,
            ILogger<PaymentsController> logger)
        {
            _context = context;
            _vnPayService = vnPayService;
            _configuration = configuration;
            _autoAssignment = autoAssignment;
            _logger = logger;
        }


        // =========================================================
        // CUSTOMER - TẠO THANH TOÁN VNPAY
        // POST: /api/v1/payments/vnpay
        // =========================================================
        [Authorize(Roles = "customer")]
        [HttpPost("vnpay")]
        public async Task<IActionResult> CreateVnPayPayment(
            [FromBody] CreateVnPayPaymentRequest request)
        {
            var customerIdText =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    customerIdText,
                    out var customerId))
            {
                return Unauthorized(new
                {
                    message = "Token không hợp lệ."
                });
            }


            // Kiểm tra đơn hàng có thuộc customer này không
            var shipment =
                await _context.Shipments
                    .FirstOrDefaultAsync(x =>
                        x.Id == request.ShipmentId &&
                        x.CustomerId == customerId
                    );

            if (shipment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy đơn hàng hoặc đơn hàng không thuộc tài khoản của bạn."
                });
            }


            // Chỉ shop_prepaid mới thanh toán phí vận chuyển online
            if (shipment.FeePayer != "shop_prepaid")
            {
                return BadRequest(new
                {
                    message =
                        "Đơn hàng này không sử dụng hình thức người gửi thanh toán phí trước."
                });
            }


            if (shipment.Fee <= 0)
            {
                return BadRequest(new
                {
                    message =
                        "Phí vận chuyển của đơn hàng không hợp lệ."
                });
            }


            // Nếu đã thanh toán thành công rồi thì không tạo lại
            var alreadyPaid =
                await _context.Payments
                    .AnyAsync(x =>
                        x.ShipmentId == shipment.Id &&
                        x.Status == "paid"
                    );

            if (alreadyPaid)
            {
                return Conflict(new
                {
                    message =
                        "Đơn hàng này đã được thanh toán."
                });
            }


            // A pending cash request must be completed/cancelled before a
            // different payment path is started. Never allow two methods to
            // collect the same shipping fee.
            var cashPending = await _context.Payments.AnyAsync(x =>
                x.ShipmentId == shipment.Id && x.Status == "pending" &&
                x.Method == "cash");
            if (cashPending)
                return Conflict(new
                {
                    message = "Đơn đang chờ Operations xác nhận thu tiền mặt. Không thể tạo thêm VNPay."
                });

            // Mã giao dịch gửi sang VNPay
            // vnp_TxnRef yêu cầu duy nhất
            var transactionReference =
                Guid.NewGuid()
                    .ToString("N")
                    .ToUpperInvariant();


            var payment =
                new Payment
                {
                    Id =
                        $"PAY-{Guid.NewGuid():N}"
                            .ToUpperInvariant(),

                    ShipmentId =
                        shipment.Id,

                    CustomerId =
                        customerId,

                    Amount =
                        shipment.Fee,

                    Method =
                        "vnpay",

                    Status =
                        "pending",

                    TransactionReference =
                        transactionReference,

                    CreatedAt =
                        DateTime.UtcNow
                };


            // Lấy IP client
            var forwardedIp =
                Request.Headers[
                    "X-Forwarded-For"
                ].FirstOrDefault();

            var ipAddress =
                !string.IsNullOrWhiteSpace(
                    forwardedIp)
                    ? forwardedIp
                        .Split(',')[0]
                        .Trim()
                    : HttpContext
                        .Connection
                        .RemoteIpAddress?
                        .ToString()
                        ?? "127.0.0.1";


            // Tạo URL thanh toán VNPay
            var paymentUrl =
                _vnPayService.CreatePaymentUrl(
                    payment.Amount,
                    payment.TransactionReference,
                    $"Thanh toan phi van chuyen don hang {shipment.Id}",
                    ipAddress
                );


            // Lưu Payment pending
            _context.Payments.Add(
                payment
            );

            await _context.SaveChangesAsync();


            return Ok(new
            {
                message =
                    "Tạo yêu cầu thanh toán VNPay thành công.",

                paymentId =
                    payment.Id,

                shipmentId =
                    shipment.Id,

                amount =
                    payment.Amount,

                status =
                    payment.Status,

                transactionReference =
                    payment.TransactionReference,

                paymentUrl
            });
        }
        [Authorize(Roles = "customer")]
        [HttpGet("statuses")]
        public async Task<IActionResult> GetPaymentStatuses()
        {
            var customerIdText =
                User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!int.TryParse(customerIdText, out var customerId))
                return Unauthorized();

            var payments = await _context.Payments
                .AsNoTracking()
                .Where(p => p.CustomerId == customerId)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new
                {
                    p.ShipmentId,
                    p.Status,
                    p.CreatedAt
                })
                .ToListAsync();

            var result = payments
     .GroupBy(p => p.ShipmentId)
     .Select(group => new
     {
         shipmentId = group.Key,
         status = group.Any(p => p.Status == "paid")
             ? "paid"
             : group.OrderByDescending(p => p.CreatedAt)
                    .First().Status
     })
     .ToList();

            return Ok(result);
        }

        // =========================================================
        // CUSTOMER - XEM TRẠNG THÁI PAYMENT
        // GET: /api/v1/payments/{paymentId}
        // =========================================================
        [Authorize(Roles = "customer")]
        [HttpGet("{paymentId}")]
        public async Task<IActionResult> GetPayment(
            string paymentId)
        {
            var customerIdText =
                User.FindFirstValue(
                    ClaimTypes.NameIdentifier
                );

            if (!int.TryParse(
                    customerIdText,
                    out var customerId))
            {
                return Unauthorized();
            }


            var payment =
                await _context.Payments
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x =>
                        x.Id == paymentId &&
                        x.CustomerId == customerId
                    );

            if (payment == null)
            {
                return NotFound(new
                {
                    message =
                        "Không tìm thấy giao dịch."
                });
            }


            return Ok(new
            {
                payment.Id,
                payment.ShipmentId,
                payment.Amount,
                payment.Method,
                payment.Status,
                payment.TransactionReference,
                payment.GatewayTransactionNo,
                payment.BankCode,
                payment.ResponseCode,
                payment.TransactionStatus,
                payment.CreatedAt,
                payment.PaidAt
            });
        }


        // =========================================================
        // VNPAY RETURN URL
        // VNPay redirect trình duyệt khách hàng về đây
        //
        // GET:
        // /api/v1/payments/vnpay/return
        // =========================================================
        [AllowAnonymous]
        [HttpGet("vnpay/return")]
        public async Task<IActionResult> VnPayReturn()
        {
            var query = Request.Query;

            // 1. Kiểm tra chữ ký
            if (!_vnPayService.ValidateSignature(query))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Chữ ký VNPay không hợp lệ."
                });
            }

            var transactionReference =
                query["vnp_TxnRef"].ToString();

            // 2. Tìm payment
            var payment =
                await _context.Payments
                    .FirstOrDefaultAsync(x =>
                        x.TransactionReference ==
                        transactionReference
                    );

            if (payment == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "Không tìm thấy giao dịch."
                });
            }

            if (payment.Method != "vnpay")
                return BadRequest(new { success = false, message = "Giao dịch không thuộc VNPay." });

            // 3. Kiểm tra số tiền
            if (!long.TryParse(
                    query["vnp_Amount"],
                    out var vnpAmount))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Số tiền VNPay trả về không hợp lệ."
                });
            }

            if (vnpAmount != payment.Amount * 100)
            {
                return BadRequest(new
                {
                    success = false,
                    message = "Số tiền giao dịch không khớp."
                });
            }

            var responseCode =
                query["vnp_ResponseCode"].ToString();

            var transactionStatus =
                query["vnp_TransactionStatus"].ToString();

            var success =
                responseCode == "00" &&
                transactionStatus == "00";

            // =====================================================
            // FALLBACK CHO SANDBOX
            // Nếu IPN chưa gọi về thì Return URL vẫn cập nhật DB.
            // Chỉ xử lý khi Payment còn pending để tránh update lặp.
            // =====================================================
            if (payment.Status == "pending")
            {
                payment.ResponseCode =
                    responseCode;

                payment.TransactionStatus =
                    transactionStatus;

                payment.GatewayTransactionNo =
                    query["vnp_TransactionNo"].ToString();

                payment.BankCode =
                    query["vnp_BankCode"].ToString();

                if (success)
                {
                    payment.Status = "paid";

                    payment.PaidAt =
                        DateTime.UtcNow;

                    payment.FailedAt = null;

                    payment.FailureReason = null;
                }
                else
                {
                    payment.Status = "failed";

                    payment.FailedAt =
                        DateTime.UtcNow;

                    payment.FailureReason =
                        $"VNPay ResponseCode: {responseCode}";
                }

                await _context.SaveChangesAsync();
                if (success)
                    await TryDispatchAfterPaidAsync(payment.ShipmentId);
            }

            // URL được cấu hình cố định ở server, không nhận URL redirect từ query.
            // Frontend sử dụng JWT để tải trạng thái payment từ API riêng.
            var webBaseUrl = _configuration["Frontend:BaseUrl"];
            if (string.IsNullOrWhiteSpace(webBaseUrl) ||
                !Uri.TryCreate(webBaseUrl, UriKind.Absolute, out var webUri) ||
                (webUri.Scheme != Uri.UriSchemeHttp && webUri.Scheme != Uri.UriSchemeHttps))
            {
                return StatusCode(500, new { message = "Chưa cấu hình Frontend:BaseUrl hợp lệ." });
            }

            var resultUrl = webBaseUrl.TrimEnd('/') +
                "/payment/result?paymentId=" + Uri.EscapeDataString(payment.Id);
            return Redirect(resultUrl);
        }


        // =========================================================
        // VNPAY IPN
        //
        // Server VNPay gọi trực tiếp endpoint này.
        // Đây là nơi cập nhật database.
        //
        // GET:
        // /api/v1/payments/vnpay/ipn
        // =========================================================
        [AllowAnonymous]
        [HttpGet("vnpay/ipn")]
        public async Task<IActionResult> VnPayIpn()
        {
            try
            {
                var query =
                    Request.Query;


                // 1. Kiểm tra checksum
                if (!_vnPayService
                    .ValidateSignature(query))
                {
                    return Ok(new
                    {
                        RspCode = "97",
                        Message =
                            "Invalid Signature"
                    });
                }


                var transactionReference =
                    query["vnp_TxnRef"]
                        .ToString();


                // 2. Tìm payment
                var payment =
                    await _context.Payments
                        .FirstOrDefaultAsync(x =>
                            x.TransactionReference ==
                            transactionReference
                        );

                if (payment == null)
                {
                    return Ok(new
                    {
                        RspCode = "01",
                        Message =
                            "Order not found"
                    });
                }
                if (payment.Method != "vnpay")
                    return Ok(new { RspCode = "04", Message = "Invalid Payment Method" });



                // 3. Kiểm tra amount
                if (!long.TryParse(
                        query["vnp_Amount"],
                        out var vnpAmount))
                {
                    return Ok(new
                    {
                        RspCode = "04",
                        Message =
                            "Invalid Amount"
                    });
                }


                if (vnpAmount !=
                    payment.Amount * 100)
                {
                    return Ok(new
                    {
                        RspCode = "04",
                        Message =
                            "Invalid Amount"
                    });
                }


                // 4. Tránh xử lý lại giao dịch
                if (payment.Status != "pending")
                {
                    return Ok(new
                    {
                        RspCode = "02",
                        Message =
                            "Order already confirmed"
                    });
                }


                var responseCode =
                    query["vnp_ResponseCode"]
                        .ToString();

                var transactionStatus =
                    query[
                        "vnp_TransactionStatus"
                    ].ToString();


                // Lưu dữ liệu VNPay trả về
                payment.ResponseCode =
                    responseCode;

                payment.TransactionStatus =
                    transactionStatus;

                payment.GatewayTransactionNo =
                    query["vnp_TransactionNo"]
                        .ToString();

                payment.BankCode =
                    query["vnp_BankCode"]
                        .ToString();


                // 5. Thành công
                if (responseCode == "00" &&
                    transactionStatus == "00")
                {
                    payment.Status =
                        "paid";

                    payment.PaidAt =
                        DateTime.UtcNow;
                }
                else
                {
                    payment.Status =
                        "failed";
                }


                await _context.SaveChangesAsync();
                if (payment.Status == "paid")
                    await TryDispatchAfterPaidAsync(payment.ShipmentId);

                // VNPay yêu cầu JSON RspCode + Message
                return Ok(new
                {
                    RspCode = "00",
                    Message =
                        "Confirm Success"
                });
            }
            catch
            {
                return Ok(new
                {
                    RspCode = "99",
                    Message =
                        "Unknown error"
                });
            }
        }

        // Never fail a verified payment just because there is no free Staff.
        // Retry can be triggered from Operations after staffing changes.
        private async Task TryDispatchAfterPaidAsync(string shipmentId)
        {
            try
            {
                await _autoAssignment.TryAssignAsync(shipmentId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "VNPay confirmed but dispatch failed for shipment {ShipmentId}", shipmentId);
            }
        }
    }
}