using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Models;

[Index(nameof(Code), IsUnique = true)]
[Index(nameof(Name))]
public class Area
{
    public int Id { get; set; }

    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(150)]
    public string Name { get; set; } = string.Empty;

    // ward / commune / special_zone
    [Required]
    [StringLength(30)]
    public string Type { get; set; } = "ward";

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<StaffArea> StaffAreas { get; set; } = new();
}
