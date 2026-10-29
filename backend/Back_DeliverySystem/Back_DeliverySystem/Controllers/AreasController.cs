using Back_DeliverySystem.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Controllers;

[ApiController]
[Route("api/v1/areas")]
[Authorize]
public class AreasController : ControllerBase
{
    private readonly AppDbContext _db;

    public AreasController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        CancellationToken cancellationToken)
    {
        var areas = await _db.Areas
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Type)
            .ThenBy(x => x.Name)
            .Select(x => new
            {
                id = x.Id,
                code = x.Code,
                name = x.Name,
                type = x.Type
            })
            .ToListAsync(cancellationToken);

        return Ok(areas);
    }
}
