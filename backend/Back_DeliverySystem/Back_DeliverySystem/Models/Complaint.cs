namespace Back_DeliverySystem.Models;

public class Complaint
{
    public int Id { get; set; }

    // Đơn hàng mà khiếu nại thuộc về
    public string ShipmentId { get; set; } = string.Empty;

    // Người tạo khiếu nại
    public int? CustomerId { get; set; }

    // damaged, delayed, lost, wrong_item, other
    public string Type { get; set; } = string.Empty;

    // Nội dung khách hàng nhập
    public string Content { get; set; } = string.Empty;

    // pending, processing, resolved
    public string Status { get; set; } = "pending";

    // Phản hồi sau khi xử lý
    public string? Response { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ResolvedAt { get; set; }

    // Quan hệ với Shipment
    public Shipment? Shipment { get; set; }
        // customer | staff
    public string Source { get; set; } = "customer";

    // Operations phân loại: delivery_delay, goods_damage, staff_attitude, cod_payment, other
    public string? Category { get; set; }

    // Dùng cho #22 (sự cố do Staff báo)
    public int? ReportedByUserId { get; set; }
    public int? ReportedByStaffId { get; set; }
    public int? AssignmentId { get; set; }

    // Operations xử lý gần nhất
    public int? HandledByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public List<ComplaintHistory> History { get; set; } = new();
}