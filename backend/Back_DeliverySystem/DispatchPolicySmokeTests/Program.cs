using Back_DeliverySystem.Models;
using Back_DeliverySystem.Services;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception("Dispatch policy failed: " + message);
}

Check(ServiceDispatchPolicy.ForService("standard") == ServiceDispatchPolicy.AreaRoute,
    "standard must use area/route strategy");
Check(ServiceDispatchPolicy.ForService("fast") == ServiceDispatchPolicy.PriorityArea,
    "fast must use priority area strategy");
Check(ServiceDispatchPolicy.ForService("express") == ServiceDispatchPolicy.GpsOnDemand,
    "express must prefer GPS on demand");

Check(ServiceDispatchPolicy.DirectDistanceKm(10.75, 106.65, 10.75, 106.65) < 0.000001,
    "same coordinate should have zero distance");
var oneKm = ServiceDispatchPolicy.DirectDistanceKm(10.75, 106.65, 10.759, 106.65);
Check(oneKm > 0.9 && oneKm < 1.1, "Haversine should rank ~1km correctly");

var validShipment = new Shipment { PickupLatitude = 10.75, PickupLongitude = 106.65 };
Check(ServiceDispatchPolicy.HasPickupCoordinates(validShipment), "valid pickup coordinates");
Check(!ServiceDispatchPolicy.HasPickupCoordinates(new Shipment()),
    "missing pickup coordinates should not be treated as GPS");
Check(!ServiceDispatchPolicy.HasPickupCoordinates(new Shipment {
    PickupLatitude = 91, PickupLongitude = 106.65
}), "invalid latitude must be rejected");

var utcNow = DateTime.UtcNow;
var point = new StaffLocation {
    StaffId = 1, Latitude = 10.75, Longitude = 106.65,
    AccuracyMeters = 30, UpdatedAt = utcNow.AddMinutes(-2)
};
Check(ServiceDispatchPolicy.IsFreshEnough(point, utcNow), "fresh GPS should qualify");
point.UpdatedAt = utcNow.AddMinutes(-30);
Check(!ServiceDispatchPolicy.IsFreshEnough(point, utcNow), "stale GPS must not qualify");
point.UpdatedAt = utcNow;
point.AccuracyMeters = 5000;
Check(!ServiceDispatchPolicy.IsFreshEnough(point, utcNow), "imprecise GPS must not qualify");
point.AccuracyMeters = 30;
point.Latitude = 100;
Check(!ServiceDispatchPolicy.IsFreshEnough(point, utcNow), "impossible GPS point must not qualify");

Console.WriteLine("PASS: 12 dispatch strategy/GPS policy smoke assertions.");
