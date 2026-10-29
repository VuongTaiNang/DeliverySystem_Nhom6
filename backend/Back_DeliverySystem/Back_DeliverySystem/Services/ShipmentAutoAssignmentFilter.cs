using System.Reflection;
using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs.Customer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Services;

/// <summary>
/// Gắn AreaId vào Shipment vừa tạo và kích hoạt auto-assignment mà không làm
/// thay đổi flow OrderController hiện tại. Chỉ chạy cho action có
/// CreateShipmentRequest.
/// </summary>
public sealed class ShipmentAutoAssignmentFilter : IAsyncActionFilter
{
    private readonly AppDbContext _db;
    private readonly IAutoAssignmentService _autoAssignment;

    public ShipmentAutoAssignmentFilter(
        AppDbContext db,
        IAutoAssignmentService autoAssignment)
    {
        _db = db;
        _autoAssignment = autoAssignment;
    }

    public async Task OnActionExecutionAsync(
        ActionExecutingContext context,
        ActionExecutionDelegate next)
    {
        var request = context.ActionArguments.Values
            .OfType<CreateShipmentRequest>()
            .FirstOrDefault();

        if (request == null)
        {
            await next();
            return;
        }

        var cancellationToken =
            context.HttpContext.RequestAborted;

        if (request.PickupAreaId.HasValue)
        {
            var pickupAreaValid = await _db.Areas.AnyAsync(
                x => x.Id == request.PickupAreaId.Value && x.IsActive,
                cancellationToken
            );

            if (!pickupAreaValid)
            {
                context.Result = new BadRequestObjectResult(new
                {
                    message = "Khu vực lấy hàng không tồn tại hoặc đã ngừng hoạt động."
                });
                return;
            }
        }

        if (request.DeliveryAreaId.HasValue)
        {
            var deliveryAreaValid = await _db.Areas.AnyAsync(
                x => x.Id == request.DeliveryAreaId.Value && x.IsActive,
                cancellationToken
            );

            if (!deliveryAreaValid)
            {
                context.Result = new BadRequestObjectResult(new
                {
                    message = "Khu vực giao hàng không tồn tại hoặc đã ngừng hoạt động."
                });
                return;
            }
        }

        var executed = await next();

        if (executed.Exception != null && !executed.ExceptionHandled)
        {
            return;
        }

        if (request.PickupAreaId == null &&
            request.DeliveryAreaId == null)
        {
            // Client cũ vẫn hoạt động bình thường, chỉ chưa auto-assign.
            return;
        }

        var shipmentId = GetShipmentId(executed.Result);

        if (string.IsNullOrWhiteSpace(shipmentId))
        {
            return;
        }

        var shipment = await _db.Shipments.FirstOrDefaultAsync(
            x => x.Id == shipmentId,
            cancellationToken
        );

        if (shipment == null)
        {
            return;
        }

        shipment.PickupAreaId = request.PickupAreaId;
        shipment.DeliveryAreaId = request.DeliveryAreaId;

        await _db.SaveChangesAsync(cancellationToken);

        if (shipment.DeliveryAreaId.HasValue)
        {
            await _autoAssignment.TryAssignAsync(
                shipment.Id,
                cancellationToken
            );
        }
    }

    private static string? GetShipmentId(IActionResult? result)
    {
        object? value = result switch
        {
            ObjectResult objectResult => objectResult.Value,
            _ => null
        };

        if (value == null)
        {
            return null;
        }

        if (value is IDictionary<string, object?> dictionary &&
            dictionary.TryGetValue("id", out var dictionaryId))
        {
            return dictionaryId?.ToString();
        }

        var property = value.GetType().GetProperty(
            "id",
            BindingFlags.Public |
            BindingFlags.Instance |
            BindingFlags.IgnoreCase
        );

        return property?.GetValue(value)?.ToString();
    }
}
