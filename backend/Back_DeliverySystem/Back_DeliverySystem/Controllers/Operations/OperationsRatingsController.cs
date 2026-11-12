using Back_DeliverySystem.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers.Operations;

[ApiController]
[Authorize(Roles = "operations")]
[Route("api/v1/operations/ratings")]
public sealed class OperationsRatingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public OperationsRatingsController(AppDbContext db) => _db = db;

    // Chỉ Operations có thể đọc phản hồi; không được sửa/xóa đánh giá của Customer.
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var ratings = await (
            from rating in _db.DeliveryRatings.AsNoTracking()
            join shipment in _db.Shipments.AsNoTracking()
                on rating.ShipmentId equals shipment.Id
            orderby (rating.UpdatedAt ?? rating.CreatedAt) descending
            select new
            {
                rating.Id,
                rating.ShipmentId,
                rating.CustomerId,
                rating.Score,
                rating.Comment,
                rating.CreatedAt,
                rating.UpdatedAt,
                shipment.Service
            }
        ).Take(200).ToListAsync(cancellationToken);

        return Ok(ratings);
    }
}
