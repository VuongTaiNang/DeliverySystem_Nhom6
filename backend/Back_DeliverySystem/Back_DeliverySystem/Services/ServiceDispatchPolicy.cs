using Back_DeliverySystem.Models;

namespace Back_DeliverySystem.Services;

/// <summary>
/// Sprint 3 dispatch strategies. No change to the persisted Shipment.Service values.
/// Area/route mode is the existing assignment algorithm; route optimization remains
/// an Operations workflow. Express uses a fresh voluntary GPS fix when available.
/// </summary>
public static class ServiceDispatchPolicy
{
    public const string AreaRoute = "area_route";
    public const string PriorityArea = "priority_area";
    public const string GpsOnDemand = "gps_on_demand";

    // Demo defaults, not a delivery-time SLA or a geographic pricing promise.
    public static readonly TimeSpan MaxGpsAge = TimeSpan.FromMinutes(15);
    public const double MaxGpsAccuracyMeters = 1000d;
    public const double MaxPickupDistanceKm = 20d;

    public static string ForService(string? service) => service switch
    {
        "express" => GpsOnDemand,
        "fast" => PriorityArea,
        _ => AreaRoute
    };

    public static bool HasPickupCoordinates(Shipment shipment) =>
        shipment.PickupLatitude is >= -90 and <= 90 &&
        shipment.PickupLongitude is >= -180 and <= 180 &&
        double.IsFinite(shipment.PickupLatitude.Value) &&
        double.IsFinite(shipment.PickupLongitude.Value);

    public static bool IsFreshEnough(StaffLocation location, DateTime nowUtc) =>
        location.UpdatedAt >= nowUtc - MaxGpsAge &&
        location.UpdatedAt <= nowUtc.AddMinutes(1) &&
        (!location.AccuracyMeters.HasValue ||
         location.AccuracyMeters.Value is >= 0 and <= MaxGpsAccuracyMeters) &&
        double.IsFinite(location.Latitude) &&
        double.IsFinite(location.Longitude) &&
        location.Latitude is >= -90 and <= 90 &&
        location.Longitude is >= -180 and <= 180;

    /// <summary>Great-circle distance for ranking candidates, not road travel time.</summary>
    public static double DirectDistanceKm(
        double fromLatitude, double fromLongitude,
        double toLatitude, double toLongitude)
    {
        const double earthRadiusKm = 6371d;
        var lat1 = fromLatitude * Math.PI / 180d;
        var lat2 = toLatitude * Math.PI / 180d;
        var latitudeDelta = (toLatitude - fromLatitude) * Math.PI / 180d;
        var longitudeDelta = (toLongitude - fromLongitude) * Math.PI / 180d;

        var a = Math.Pow(Math.Sin(latitudeDelta / 2d), 2d) +
                Math.Cos(lat1) * Math.Cos(lat2) *
                Math.Pow(Math.Sin(longitudeDelta / 2d), 2d);
        return 2d * earthRadiusKm * Math.Asin(Math.Sqrt(Math.Clamp(a, 0d, 1d)));
    }
}
