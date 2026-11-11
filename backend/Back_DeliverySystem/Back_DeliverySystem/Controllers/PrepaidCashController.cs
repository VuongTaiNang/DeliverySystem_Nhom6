using System.Data;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.Models;
using Back_DeliverySystem.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers;

/// <summary>
/// Shop prepaid CASH: Customer requests to pay cash, Operations verifies an
/// actual physical receipt, then dispatch is attempted. No money is moved by
/// this API. Reuses Payments.Method/TransactionReference, so no migration.
/// </summary>
[ApiController]
[Route("api/v1/payments")]
public class PrepaidCashController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAutoAssignmentService _dispatcher;
    private readonly ILogger<PrepaidCashController> _logger;

    public PrepaidCashController(
        AppDbContext db,
        IAutoAssignmentService dispatcher,
        ILogger<PrepaidCashController> logger)
    {
        _db = db;
        _dispatcher = dispatcher;
        _logger = logger;
    }

    public sealed class CreateCashRequest
    {
        public string ShipmentId { get; set; } = "";
    }

    public sealed class ConfirmCashRequest
    {
        public string ReceiptReference { get; set; } = "";
    }

    // Customer can inspect payment by shipment ID, even after re-login.
    [Authorize(Roles = "customer")]
    [HttpGet("shipment/{shipmentId}")]
    public async Task<IActionResult> ForShipment(
        string shipmentId, CancellationToken cancellationToken)
    {
        if (!TryUserId(out var customerId)) return Unauthorized();
        var shipment = await _db.Shipments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == shipmentId && x.CustomerId == customerId,
                cancellationToken);
        if (shipment == null) return NotFound(new { message = "Không tìm thấy vận đơn của bạn." });

        var payments = await _db.Payments.AsNoTracking()
            .Where(x => x.ShipmentId == shipment.Id && x.CustomerId == customerId)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(cancellationToken);
        var payment = payments.FirstOrDefault(x => x.Status == "paid") ??
                      payments.FirstOrDefault(x => x.Status == "pending") ??
                      payments.FirstOrDefault();
        if (payment == null) return Ok(new
        {
            paymentId = (string?)null,
            shipmentId, amount = shipment.Fee,
            status = "unpaid", method = (string?)null,
            transactionReference = (string?)null
        });
        return Ok(new
        {
            paymentId = payment.Id,
            shipmentId = payment.ShipmentId,
            amount = payment.Amount,
            status = payment.Status,
            method = payment.Method,
            transactionReference = payment.TransactionReference,
            paidAt = payment.PaidAt
        });
    }

    // Customer can REQUEST cash, but cannot mark it paid.
    [Authorize(Roles = "customer")]
    [HttpPost("cash/request")]
    public async Task<IActionResult> RequestCash(
        [FromBody] CreateCashRequest request, CancellationToken cancellationToken)
    {
        if (!TryUserId(out var customerId)) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.ShipmentId))
            return BadRequest(new { message = "Thiếu mã vận đơn." });

        await using var transaction = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        var shipment = await _db.Shipments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.ShipmentId &&
                                      x.CustomerId == customerId, cancellationToken);
        if (shipment == null) return NotFound(new { message = "Không tìm thấy vận đơn của bạn." });
        if (shipment.FeePayer != "shop_prepaid" || shipment.Fee <= 0)
            return BadRequest(new { message = "Chỉ được yêu cầu thu tiền mặt cho đơn Shop trả trước có phí hợp lệ." });
        if (shipment.Status is not ("pending_pickup" or "pickup_failed"))
            return Conflict(new { message = "Đơn đã qua giai đoạn được phép yêu cầu thu phí trước." });

        var payments = await _db.Payments
            .Where(x => x.ShipmentId == shipment.Id && x.Status != "failed")
            .ToListAsync(cancellationToken);
        if (payments.Any(x => x.Status == "paid"))
            return Conflict(new { message = "Đơn đã thanh toán phí vận chuyển." });
        var pending = payments.FirstOrDefault(x => x.Status == "pending");
        if (pending != null)
        {
            if (pending.Method != "cash")
                return Conflict(new { message = "Đơn đang có giao dịch VNPay chờ xử lý. Vui lòng kiểm tra hoặc xử lý giao dịch đó trước khi chọn tiền mặt." });
            return Ok(new
            {
                paymentId = pending.Id, shipmentId, amount = pending.Amount,
                method = pending.Method, status = pending.Status,
                message = "Yêu cầu nộp tiền mặt đã được ghi nhận. Đợi Operations kiểm tra biên nhận."
            });
        }

        var payment = new Payment
        {
            Id = $"PAY-{Guid.NewGuid():N}".ToUpperInvariant(),
            ShipmentId = shipment.Id,
            CustomerId = customerId,
            Amount = shipment.Fee,
            Method = "cash",
            Status = "pending",
            TransactionReference = $"CASHREQ-{Guid.NewGuid():N}".ToUpperInvariant(),
            CreatedAt = DateTime.UtcNow
        };
        _db.Payments.Add(payment);
        _db.ShipmentEvents.Add(new ShipmentEvent
        {
            ShipmentId = shipment.Id,
            Status = "waiting_payment",
            At = DateTime.UtcNow,
            Note = "Shop đăng ký thanh toán phí vận chuyển bằng tiền mặt; đang chờ Operations kiểm tra và xác nhận thu tiền."
        });
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Ok(new
        {
            paymentId = payment.Id, shipmentId = shipment.Id, amount = payment.Amount,
            method = payment.Method, status = payment.Status,
            message = "Đã đăng ký nộp tiền mặt. Chỉ Operations có quyền xác nhận đã thu."
        });
    }

    [Authorize(Roles = "operations")]
    [HttpGet("cash/pending")]
    public async Task<IActionResult> PendingCash(CancellationToken cancellationToken)
    {
        var rows = await (
            from p in _db.Payments.AsNoTracking()
            join shipment in _db.Shipments.AsNoTracking()
                on p.ShipmentId equals shipment.Id
            where p.Method == "cash" && p.Status == "pending" &&
                  shipment.FeePayer == "shop_prepaid"
            orderby p.CreatedAt descending
            select new
            {
                paymentId = p.Id, shipmentId = shipment.Id,
                amount = p.Amount, status = p.Status,
                customerId = p.CustomerId, senderName = shipment.SenderName,
                pickupAddress = shipment.PickupAddress,
                createdAt = p.CreatedAt
            }
        ).Take(100).ToListAsync(cancellationToken);
        return Ok(rows);
    }

    // Physical cash can ONLY be confirmed by authenticated Operations,
    // after receipt checking. Serializability prevents double confirmation.
    [Authorize(Roles = "operations")]
    [HttpPost("cash/{paymentId}/confirm")]
    public async Task<IActionResult> ConfirmCash(
        string paymentId, [FromBody] ConfirmCashRequest request,
        CancellationToken cancellationToken)
    {
        if (!TryUserId(out var operationsUserId)) return Unauthorized();
        var receipt = (request.ReceiptReference ?? "").Trim().ToUpperInvariant();
        if (receipt.Length is < 6 or > 70 ||
            !Regex.IsMatch(receipt, @"^[A-Z0-9][A-Z0-9/_-]*$"))
            return BadRequest(new { message = "Mã biên nhận phải dài 6–70 ký tự, gồm chữ, số, dấu -, _ hoặc /." });

        await using var transaction = await _db.Database.BeginTransactionAsync(
            IsolationLevel.Serializable, cancellationToken);

        var payment = await _db.Payments
            .FirstOrDefaultAsync(x => x.Id == paymentId && x.Method == "cash", cancellationToken);
        if (payment == null) return NotFound(new { message = "Không tìm thấy yêu cầu thu phí tiền mặt." });
        if (payment.Status != "pending")
            return Conflict(new { message = "Yêu cầu này đã xử lý, không thể xác nhận lại." });

        var shipment = await _db.Shipments
            .FirstOrDefaultAsync(x => x.Id == payment.ShipmentId, cancellationToken);
        if (shipment == null || shipment.FeePayer != "shop_prepaid" ||
            shipment.Fee <= 0 || payment.Amount != shipment.Fee ||
            payment.CustomerId != shipment.CustomerId)
            return Conflict(new { message = "Dữ liệu vận đơn và yêu cầu thanh toán không khớp." });
        if (shipment.Status is not ("pending_pickup" or "pickup_failed"))
            return Conflict(new { message = "Trạng thái vận đơn không còn phù hợp để xác nhận thu phí trước." });

        if (await _db.Payments.AnyAsync(x =>
                x.ShipmentId == shipment.Id && x.Status == "paid", cancellationToken))
            return Conflict(new { message = "Phí vận chuyển của đơn đã được thanh toán." });

        var receiptKey = "CASH-" + receipt;
        if (await _db.Payments.AnyAsync(x =>
                x.Method == "cash" && x.Status == "paid" &&
                x.TransactionReference == receiptKey, cancellationToken))
            return Conflict(new { message = "Mã biên nhận đã được sử dụng." });

        var paidAt = DateTime.UtcNow;
        payment.Status = "paid";
        payment.PaidAt = paidAt;
        payment.TransactionReference = receiptKey;
        payment.FailedAt = null;
        payment.FailureReason = null;

        _db.ShipmentEvents.Add(new ShipmentEvent
        {
            ShipmentId = shipment.Id,
            Status = "shipping_fee_paid",
            At = paidAt,
            Note = $"Operations (UserId {operationsUserId}) đã xác nhận nhận tiền mặt phí vận chuyển {payment.Amount:N0}đ; biên nhận {receipt}."
        });
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // Reuse the existing transactional dispatcher. An unavailable Staff
        // doesn't undo verified payment; Operations can retry later.
        AutoAssignmentResult? dispatch = null;
        try
        {
            dispatch = await _dispatcher.TryAssignAsync(shipment.Id, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Cash prepaid confirmed but auto assignment failed for shipment {ShipmentId}",
                shipment.Id);
        }
        return Ok(new
        {
            message = "Đã ghi nhận thu đủ phí tiền mặt. Đây là xác nhận thu tiền, không phải lệnh chuyển khoản.",
            paymentId = payment.Id,
            shipmentId = shipment.Id,
            amount = payment.Amount,
            status = payment.Status,
            method = payment.Method,
            receiptReference = receipt,
            confirmedBy = operationsUserId,
            autoAssigned = dispatch?.Assigned ?? false,
            autoAssignmentMessage = dispatch?.Reason ??
                "Không thể tự phân công ngay; Operations có thể thử lại sau."
        });
    }

    private bool TryUserId(out int id) =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out id);
}
