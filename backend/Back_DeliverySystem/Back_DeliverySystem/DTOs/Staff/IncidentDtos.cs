using System.ComponentModel.DataAnnotations;

namespace Back_DeliverySystem.DTOs.Staff;

public class CreateIncidentRequest
{
    [Required(ErrorMessage = "Loại sự cố không được để trống.")]
    [StringLength(50)]
    public string Type { get; set; } = string.Empty;

    [Required(ErrorMessage = "Mô tả sự cố không được để trống.")]
    [StringLength(1000, MinimumLength = 10,
        ErrorMessage = "Mô tả sự cố phải từ 10 đến 1000 ký tự.")]
    public string Description { get; set; } = string.Empty;
}