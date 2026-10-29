namespace Back_DeliverySystem.Models
{
    public class DeliveryAssignment
    {
        public int Id { get; set; }

        public string ShipmentId { get; set; } =
            string.Empty;

        public int StaffId { get; set; }

        // Manual assignment: operations user id.
        // Auto assignment: null because the system made the decision.
        public int? AssignedByUserId { get; set; }

        // manual / auto
        public string AssignmentSource { get; set; } =
            "manual";

        public DateTime AssignedAt { get; set; } =
            DateTime.UtcNow;

        // assigned / accepted / rejected / completed / cancelled
        public string Status { get; set; } =
            "assigned";

        // Assignment hiện tại có còn hiệu lực không
        public bool IsActive { get; set; } =
            true;

        public DateTime? AcceptedAt { get; set; }

        public DateTime? EndedAt { get; set; }

        public string? RejectionReason { get; set; }
    }
}