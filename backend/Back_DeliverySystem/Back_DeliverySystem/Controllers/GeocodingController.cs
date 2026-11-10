using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;

namespace Back_DeliverySystem.Controllers;

[ApiController]
[Route("api/v1/geocoding")]
public class GeocodingController : ControllerBase
{
    // User-initiated searches only. Never use the public Nominatim API for
    // autocomplete or bulk geocoding. Limit Nominatim to <= 1 request/sec
    // across this app instance, and cache repeat results for this demo.
    private static readonly HttpClient Client = CreateClient();
    private static readonly SemaphoreSlim NominatimGate = new(1, 1);
    private static DateTimeOffset LastNominatimRequest = DateTimeOffset.MinValue;
    private static readonly ConcurrentDictionary<string, CacheEntry> Cache = new();

    private sealed record GeocodePoint(
        double Latitude, double Longitude, string DisplayName,
        string Source, bool Approximate);

    private sealed record CacheEntry(GeocodePoint Point, DateTimeOffset ExpiresAt);

    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(9) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("HUFLIT-Express-StudentDemo/1.0");
        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("vi");
        return client;
    }

    [AllowAnonymous]
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string? q, CancellationToken cancellationToken)
    {
        var keyword = q?.Trim() ?? "";
        if (keyword.Length < 3)
            return BadRequest(new { message = "Vui lòng nhập địa chỉ chi tiết hơn." });
        if (keyword.Length > 300)
            return BadRequest(new { message = "Địa chỉ quá dài." });

        var cacheKey = string.Join(" ", keyword.ToLowerInvariant()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (Cache.TryGetValue(cacheKey, out var cached) &&
            cached.ExpiresAt > DateTimeOffset.UtcNow)
        {
            return Ok(cached.Point);
        }

        GeocodePoint? result = null;
        try
        {
            result = await LookupNominatimAsync(keyword, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception error) when (error is HttpRequestException
            or TaskCanceledException or JsonException or IOException)
        {
            // DNS/timeout/provider failure: try a different provider.
        }

        if (result == null)
        {
            try
            {
                result = await LookupPhotonAsync(keyword, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception error) when (error is HttpRequestException
                or TaskCanceledException or JsonException or IOException)
            {
                // Public demo providers can both be unreachable.
            }
        }

        if (result == null)
        {
            return StatusCode(503, new
            {
                message = "Không tìm được tọa độ tự động. Hãy phóng to bản đồ và nhấp trực tiếp vào điểm lấy/giao hàng, rồi bấm Tính phí. Nếu cần, kiểm tra kết nối DNS."
            });
        }

        // Keep a small, short-lived cache of user-initiated searches.
        if (Cache.Count >= 300)
        {
            foreach (var key in Cache.Keys.Take(60))
                Cache.TryRemove(key, out _);
        }
        Cache[cacheKey] = new CacheEntry(result, DateTimeOffset.UtcNow.AddMinutes(15));
        return Ok(result);
    }

    private static async Task<GeocodePoint?> LookupNominatimAsync(
        string keyword, CancellationToken cancellationToken)
    {
        await NominatimGate.WaitAsync(cancellationToken);
        try
        {
            var delay = LastNominatimRequest.AddMilliseconds(1100) -
                        DateTimeOffset.UtcNow;
            if (delay > TimeSpan.Zero)
                await Task.Delay(delay, cancellationToken);

            LastNominatimRequest = DateTimeOffset.UtcNow;
            var url = "https://nominatim.openstreetmap.org/search" +
                "?format=jsonv2&limit=1&countrycodes=vn&accept-language=vi&q=" +
                Uri.EscapeDataString(keyword);

            using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            budget.CancelAfter(TimeSpan.FromSeconds(4));
            using var response = await Client.GetAsync(url, budget.Token);
            if (!response.IsSuccessStatusCode) return null;

            await using var stream = await response.Content.ReadAsStreamAsync(budget.Token);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: budget.Token);
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Array || root.GetArrayLength() == 0)
                return null;

            var first = root[0];
            if (!first.TryGetProperty("lat", out var latEl) ||
                !first.TryGetProperty("lon", out var lonEl) ||
                !double.TryParse(latEl.GetString(), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out var lat) ||
                !double.TryParse(lonEl.GetString(), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out var lon) ||
                !InVietnam(lat, lon))
                return null;

            var name = first.TryGetProperty("display_name", out var display)
                ? display.GetString() ?? keyword : keyword;
            return new GeocodePoint(
                Math.Round(lat, 7), Math.Round(lon, 7),
                name, "nominatim", false);
        }
        finally
        {
            NominatimGate.Release();
        }
    }

    // Komoot's Photon public demo is only a best-effort fallback for small
    // student demos. It is not an availability-guaranteed production service.
    private static async Task<GeocodePoint?> LookupPhotonAsync(
        string keyword, CancellationToken cancellationToken)
    {
        var url = "https://photon.komoot.io/api/?limit=5&lat=10.7769&lon=106.7009&q=" +
            Uri.EscapeDataString(keyword);
        using var budget = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        budget.CancelAfter(TimeSpan.FromSeconds(5));
        using var response = await Client.GetAsync(url, budget.Token);
        if (!response.IsSuccessStatusCode) return null;

        await using var stream = await response.Content.ReadAsStreamAsync(budget.Token);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: budget.Token);
        var root = json.RootElement;
        if (!root.TryGetProperty("features", out var features) ||
            features.ValueKind != JsonValueKind.Array)
            return null;

        foreach (var feature in features.EnumerateArray())
        {
            if (!feature.TryGetProperty("geometry", out var geom) ||
                !geom.TryGetProperty("coordinates", out var coords) ||
                coords.ValueKind != JsonValueKind.Array || coords.GetArrayLength() < 2 ||
                !coords[0].TryGetDouble(out var lon) ||
                !coords[1].TryGetDouble(out var lat) ||
                !InVietnam(lat, lon))
                continue;

            var props = feature.GetProperty("properties");
            if (props.TryGetProperty("countrycode", out var country) &&
                country.ValueKind == JsonValueKind.String &&
                !string.Equals(country.GetString(), "VN", StringComparison.OrdinalIgnoreCase))
                continue;

            static string Field(JsonElement item, string name) =>
                item.TryGetProperty(name, out var field) &&
                field.ValueKind == JsonValueKind.String ? field.GetString() ?? "" : "";

            var components = new[] {
                Field(props, "housenumber"), Field(props, "street"),
                Field(props, "name"), Field(props, "district"),
                Field(props, "city"), Field(props, "state"), Field(props, "country")
            }.Where(x => !string.IsNullOrWhiteSpace(x));
            var name = string.Join(", ", components.Distinct());
            if (string.IsNullOrWhiteSpace(name)) name = keyword;

            return new GeocodePoint(Math.Round(lat, 7), Math.Round(lon, 7),
                name, "photon", true);
        }
        return null;
    }

    private static bool InVietnam(double lat, double lon) =>
        double.IsFinite(lat) && double.IsFinite(lon) &&
        lat is >= 8 and <= 24 && lon is >= 102 and <= 110;
}
