using Back_DeliverySystem.Models;
using Microsoft.EntityFrameworkCore;

namespace Back_DeliverySystem.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Staff> Staffs => Set<Staff>();
    public DbSet<Area> Areas => Set<Area>();
    public DbSet<StaffArea> StaffAreas => Set<StaffArea>();

    public DbSet<Payment> Payments { get; set; }
    public DbSet<DeliveryRating> DeliveryRatings { get; set; }

    public DbSet<DeliveryAssignment> DeliveryAssignments => Set<DeliveryAssignment>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<ShipmentEvent> ShipmentEvents => Set<ShipmentEvent>();
    public DbSet<ShippingQuote> ShippingQuotes => Set<ShippingQuote>();
    public DbSet<PickupLocation> PickupLocations => Set<PickupLocation>();
    public DbSet<Complaint> Complaints => Set<Complaint>();

    public DbSet<DeliveryRoute> DeliveryRoutes { get; set; }

    public DbSet<RouteStop> RouteStops { get; set; }

    // Đối soát COD
    public DbSet<Settlement> Settlements => Set<Settlement>();
    public DbSet<SettlementLine> SettlementLines => Set<SettlementLine>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // =========================================================
        // STAFF
        // =========================================================
        modelBuilder.Entity<Staff>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.EmployeeCode)
                .HasMaxLength(20)
                .IsRequired();

            // Trường cũ giữ lại để tương thích UI hiện tại.
            entity.Property(x => x.Area)
                .HasMaxLength(100);

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            // Một User chỉ có tối đa một Staff Profile
            entity.HasIndex(x => x.UserId)
                .IsUnique();

            // Mã nhân viên không được trùng
            entity.HasIndex(x => x.EmployeeCode)
                .IsUnique();

            // Staff.UserId -> Users.Id
            entity.HasOne<User>()
                .WithOne()
                .HasForeignKey<Staff>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // =========================================================
        // AREA - PHƯỜNG / XÃ / ĐẶC KHU
        // =========================================================
        modelBuilder.Entity<Area>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Code)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(150)
                .IsRequired();

            entity.Property(x => x.Type)
                .HasMaxLength(30)
                .IsRequired();

            entity.HasIndex(x => x.Code)
                .IsUnique();

            entity.HasIndex(x => x.Name);
        });

        // =========================================================
        // STAFF AREA + CAPACITY
        // =========================================================
        modelBuilder.Entity<StaffArea>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.HasIndex(x => new
            {
                x.StaffId,
                x.AreaId
            })
            .IsUnique();

            entity.HasOne(x => x.Staff)
                .WithMany(x => x.StaffAreas)
                .HasForeignKey(x => x.StaffId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.Area)
                .WithMany(x => x.StaffAreas)
                .HasForeignKey(x => x.AreaId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // =========================================================
        // SHIPMENT
        // =========================================================
        modelBuilder.Entity<Shipment>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasMaxLength(50);

            entity.Property(x => x.WeightKg)
                .HasPrecision(10, 2);

            entity.Property(x => x.LengthCm)
                .HasPrecision(10, 2);

            entity.Property(x => x.WidthCm)
                .HasPrecision(10, 2);

            entity.Property(x => x.HeightCm)
                .HasPrecision(10, 2);

            entity.HasMany(x => x.Events)
                .WithOne()
                .HasForeignKey(x => x.ShipmentId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne<Area>()
                .WithMany()
                .HasForeignKey(x => x.PickupAreaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<Area>()
                .WithMany()
                .HasForeignKey(x => x.DeliveryAreaId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.PickupAreaId);
            entity.HasIndex(x => x.DeliveryAreaId);
        });

        // =========================================================
        // SHIPMENT EVENT
        // =========================================================
        modelBuilder.Entity<ShipmentEvent>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.ShipmentId)
                .HasMaxLength(50);
        });

        // =========================================================
        // SHIPPING QUOTE
        // =========================================================
        modelBuilder.Entity<ShippingQuote>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasMaxLength(50);

            entity.Property(x => x.InputHash)
                .HasMaxLength(128);
        });

        // =========================================================
        // PICKUP LOCATION
        // =========================================================
        modelBuilder.Entity<PickupLocation>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Name)
                .HasMaxLength(100);

            entity.Property(x => x.ContactName)
                .HasMaxLength(200);

            entity.Property(x => x.ContactPhone)
                .HasMaxLength(30);

            entity.Property(x => x.Address)
                .HasMaxLength(500);
        });

        // =========================================================
        // SETTLEMENT
        // =========================================================
        modelBuilder.Entity<Settlement>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasMaxLength(50);

            entity.HasMany(x => x.Lines)
                .WithOne()
                .HasForeignKey(x => x.SettlementId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // =========================================================
        // SETTLEMENT LINE
        // =========================================================
        modelBuilder.Entity<SettlementLine>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.SettlementId)
                .HasMaxLength(50);

            entity.Property(x => x.ShipmentId)
                .HasMaxLength(50);
        });

        // =========================================================
        // Delivery Assignment
        // =========================================================
        modelBuilder.Entity<DeliveryAssignment>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.ShipmentId)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.RejectionReason)
                .HasMaxLength(300);

            // Assignment -> Shipment
            entity.HasOne<Shipment>()
                .WithMany()
                .HasForeignKey(x => x.ShipmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // Assignment -> Staff
            entity.HasOne<Staff>()
                .WithMany()
                .HasForeignKey(x => x.StaffId)
                .OnDelete(DeleteBehavior.Restrict);

            // Operations User đã phân công
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(x => x.AssignedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(x => x.ShipmentId);
            entity.HasIndex(x => x.StaffId);
        });


        // =========================================================
        // Delivery Rating
        // =========================================================

        modelBuilder.Entity<DeliveryRating>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.ShipmentId)
                .IsRequired();

            entity.Property(x => x.Score)
                .IsRequired();

            entity.Property(x => x.Comment)
                .HasMaxLength(1000);

            // Mỗi Shipment chỉ có 1 đánh giá
            entity.HasIndex(x => x.ShipmentId)
                .IsUnique();

            entity.HasIndex(x => x.CustomerId);

            // Rating -> Shipment
            entity.HasOne<Shipment>()
                .WithMany()
                .HasForeignKey(x => x.ShipmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // Rating -> Customer(User)
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // =========================================================
        // Payment
        // =========================================================

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.ShipmentId)
                .IsRequired();

            entity.Property(x => x.Amount)
                .IsRequired();

            entity.Property(x => x.Method)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.Status)
                .HasMaxLength(20)
                .IsRequired();

            entity.Property(x => x.TransactionReference)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.GatewayTransactionNo)
                .HasMaxLength(100);

            entity.Property(x => x.BankCode)
                .HasMaxLength(50);

            entity.Property(x => x.ResponseCode)
                .HasMaxLength(20);

            entity.Property(x => x.TransactionStatus)
                .HasMaxLength(20);

            entity.Property(x => x.FailureReason)
                .HasMaxLength(500);

            entity.HasIndex(x => x.ShipmentId);

            entity.HasIndex(x => x.CustomerId);

            entity.HasIndex(x => x.Status);

            entity.HasIndex(x => x.TransactionReference)
                .IsUnique();

            entity.HasOne<Shipment>()
                .WithMany()
                .HasForeignKey(x => x.ShipmentId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });


        // =========================================================
        // DeliveryRoute
        // =========================================================
        modelBuilder.Entity<DeliveryRoute>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.RouteCode)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Area)
                .HasMaxLength(200);

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.Notes)
                .HasMaxLength(1000);

            entity.HasIndex(x => x.RouteCode)
                .IsUnique();

            entity.HasIndex(x => x.StaffId);

            entity.HasIndex(x => x.Status);

            entity.HasOne<Staff>()
                .WithMany()
                .HasForeignKey(x => x.StaffId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasMany(x => x.Stops)
                .WithOne(x => x.Route)
                .HasForeignKey(x => x.RouteId)
                .OnDelete(DeleteBehavior.Cascade);
        });


        // =========================================================
        // RouteStop
        // =========================================================
        modelBuilder.Entity<RouteStop>(entity =>
        {
            entity.HasKey(x => x.Id);

            entity.Property(x => x.ShipmentId)
                .IsRequired();

            entity.Property(x => x.StopType)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.AddressSnapshot)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Status)
                .HasMaxLength(30)
                .IsRequired();

            entity.Property(x => x.Notes)
                .HasMaxLength(1000);

            entity.HasIndex(x => new
            {
                x.RouteId,
                x.StopOrder
            })
            .IsUnique();

            entity.HasIndex(x => x.ShipmentId);

            entity.HasOne<Shipment>()
                .WithMany()
                .HasForeignKey(x => x.ShipmentId)
                .OnDelete(DeleteBehavior.Restrict);
        });
       
    }
}