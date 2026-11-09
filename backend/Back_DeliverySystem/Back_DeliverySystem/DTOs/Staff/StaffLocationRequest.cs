namespace Back_DeliverySystem.DTOs;

public class StaffLocationRequest
{
    public int AssignmentId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? AccuracyMeters { get; set; }
}
