using System.ComponentModel.DataAnnotations;

namespace Back_DeliverySystem.DTOs.Customer;

public class CreateComplaintRequest
{
    [Required(ErrorMessage = "Loại khiếu nại không được để trống.")]
    [StringLength(
        50,
        MinimumLength = 2,
        ErrorMessage =
            "Loại khiếu nại phải từ 2 đến 50 ký tự."
    )]
    public string Type { get; set; } =
        string.Empty;


    [Required(ErrorMessage = "Nội dung khiếu nại không được để trống.")]
    [StringLength(
        1000,
        MinimumLength = 5,
        ErrorMessage =
            "Nội dung khiếu nại phải từ 5 đến 1000 ký tự."
    )]
    public string Content { get; set; } =
        string.Empty;
}


public class UpdateComplaintRequest
{
    [Required(ErrorMessage = "Trạng thái không được để trống.")]
    [StringLength(30)]
    public string Status { get; set; } =
        string.Empty;


    [StringLength(
        1000,
        ErrorMessage =
            "Nội dung phản hồi không được vượt quá 1000 ký tự."
    )]
    public string? Response { get; set; }
}

public class ClassifyComplaintRequest
{
    [Required(ErrorMessage = "Phân loại không được để trống.")]
    [StringLength(50)]
    public string Category { get; set; } = string.Empty;
}