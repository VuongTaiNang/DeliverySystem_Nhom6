namespace Back_DeliverySystem.Models;

/// <summary>Vị trí GPS gần nhất mà Staff chủ động chia sẻ khi đang thực hiện nhiệm vụ.</summary>
public class StaffLocation
{
    public int Id { get; set; }
    public int StaffId { get; set; }
    public int AssignmentId { get; set; }
    public string ShipmentId { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? AccuracyMeters { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
