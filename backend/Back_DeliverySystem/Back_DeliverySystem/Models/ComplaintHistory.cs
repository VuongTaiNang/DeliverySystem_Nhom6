namespace Back_DeliverySystem.Models;

public class ComplaintHistory
{
    public int Id { get; set; }
    public int ComplaintId { get; set; }

    // created | classified | processing | resolved
    public string Action { get; set; } = string.Empty;
    public string? FromStatus { get; set; }
    public string? ToStatus { get; set; }
    public string? Note { get; set; }

    public int? ActorUserId { get; set; }
    // customer | staff | operations
    public string ActorRole { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Complaint? Complaint { get; set; }
}

public static class ComplaintRules
{
    public static readonly string[] CustomerTypes =
        { "damaged", "delayed", "lost", "wrong_item", "other" };

    public static readonly string[] StaffIncidentTypes =
    {
        "customer_unreachable", "wrong_address", "customer_refused",
        "goods_damaged", "vehicle_issue", "accident", "other"
    };

    public static readonly string[] Categories =
        { "delivery_delay", "goods_damage", "staff_attitude", "cod_payment", "other" };
}