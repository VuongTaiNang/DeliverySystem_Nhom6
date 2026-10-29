using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using System.Text.Json;

namespace Back_DeliverySystem.Controllers
{
    [ApiController]
    [Route("api/v1/geocoding")]
    public class GeocodingController : ControllerBase
    {
        private static readonly HttpClient HttpClient = CreateClient();

        private static HttpClient CreateClient()
        {
            var client = new HttpClient
            {
                Timeout = TimeSpan.FromSeconds(10)
            };

            client.DefaultRequestHeaders.UserAgent.ParseAdd(
                "ExpressDeliverySystem-HUFLIT/1.0"
            );
            client.DefaultRequestHeaders.AcceptLanguage.ParseAdd("vi");
            return client;
        }

        [AllowAnonymous]
        [HttpGet("search")]
        public async Task<IActionResult> Search(
            [FromQuery] string? q,
            CancellationToken cancellationToken)
        {
            var keyword = q?.Trim() ?? string.Empty;

            if (keyword.Length < 3)
            {
                return BadRequest(new
                {
                    message = "Vui lòng nhập địa chỉ chi tiết hơn."
                });
            }

            if (keyword.Length > 300)
            {
                return BadRequest(new
                {
                    message = "Địa chỉ quá dài."
                });
            }

            var query = new Dictionary<string, string?>
            {
                ["q"] = keyword,
                ["format"] = "jsonv2",
                ["limit"] = "1",
                ["countrycodes"] = "vn",
                ["accept-language"] = "vi"
            };

            var queryString = string.Join(
                "&",
                query.Select(item =>
                    $"{Uri.EscapeDataString(item.Key)}={Uri.EscapeDataString(item.Value ?? string.Empty)}")
            );

            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://nominatim.openstreetmap.org/search?{queryString}"
            );

            HttpResponseMessage response;

            try
            {
                response = await HttpClient.SendAsync(
                    request,
                    HttpCompletionOption.ResponseHeadersRead,
                    cancellationToken
                );
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                return StatusCode(504, new
                {
                    message = "Dịch vụ bản đồ phản hồi quá chậm. Vui lòng thử lại."
                });
            }
            catch
            {
                return StatusCode(502, new
                {
                    message = "Không kết nối được dịch vụ tìm địa chỉ."
                });
            }

            using (response)
            {
                if ((int)response.StatusCode == 429)
                {
                    return StatusCode(503, new
                    {
                        message = "Dịch vụ tìm địa chỉ đang giới hạn yêu cầu. Vui lòng thử lại sau."
                    });
                }

                if (!response.IsSuccessStatusCode)
                {
                    return StatusCode(502, new
                    {
                        message = "Dịch vụ tìm địa chỉ tạm thời không khả dụng."
                    });
                }

                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

                if (document.RootElement.ValueKind != JsonValueKind.Array ||
                    document.RootElement.GetArrayLength() == 0)
                {
                    return NotFound(new
                    {
                        message = "Không tìm thấy địa chỉ. Hãy nhập địa chỉ chi tiết hơn."
                    });
                }

                var first = document.RootElement[0];
                var latText = first.GetProperty("lat").GetString();
                var lonText = first.GetProperty("lon").GetString();
                var displayName = first.TryGetProperty("display_name", out var displayNameElement)
                    ? displayNameElement.GetString()
                    : keyword;

                if (!double.TryParse(latText, NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude) ||
                    !double.TryParse(lonText, NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude))
                {
                    return StatusCode(502, new
                    {
                        message = "Dịch vụ bản đồ trả về tọa độ không hợp lệ."
                    });
                }

                return Ok(new
                {
                    latitude = Math.Round(latitude, 7),
                    longitude = Math.Round(longitude, 7),
                    displayName
                });
            }
        }
    }
}
