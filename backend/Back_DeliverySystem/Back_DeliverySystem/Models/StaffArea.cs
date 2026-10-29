using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Models;

[Index(nameof(StaffId), nameof(AreaId), IsUnique = true)]
public class StaffArea
{
    public int Id { get; set; }

    public int StaffId { get; set; }

    public int AreaId { get; set; }

    [Range(1, 100)]
    public int MaxActiveOrders { get; set; } = 10;

    public bool IsActive { get; set; } = true;

    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(StaffId))]
    public Staff Staff { get; set; } = null!;

    [ForeignKey(nameof(AreaId))]
    public Area Area { get; set; } = null!;
}
