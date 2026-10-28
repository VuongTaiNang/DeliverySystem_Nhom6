using Back_DeliverySystem.Data;
using Back_DeliverySystem.DTOs;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Back_DeliverySystem.Controllers.Auth
{
    [ApiController]
    [Route("api/v1/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        private sealed class PasswordResetOtp
        {
            public required string Code { get; init; }
            public required DateTime ExpiresAt { get; init; }
            public int Attempts { get; set; }
        }

        private static readonly ConcurrentDictionary<string, PasswordResetOtp> PasswordResetOtps = new();

        public AuthController(
            AppDbContext context,
            IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.FullName) ||
                string.IsNullOrWhiteSpace(request.Phone) ||
                string.IsNullOrWhiteSpace(request.Email) ||
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { message = "Vui lòng nhập đầy đủ thông tin." });
            }

            var fullName = request.FullName.Trim();
            var email = request.Email.Trim().ToLowerInvariant();
            var phone = request.Phone.Trim();

            if (!System.Text.RegularExpressions.Regex.IsMatch(phone, @"^0[0-9]{9}$"))
            {
                return BadRequest(new { message = "Số điện thoại phải gồm 10 số và bắt đầu bằng số 0." });
            }

            if (!System.Text.RegularExpressions.Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
            {
                return BadRequest(new { message = "Email không hợp lệ." });
            }

            if (request.Password.Length < 8)
            {
                return BadRequest(new { message = "Mật khẩu phải có ít nhất 8 ký tự." });
            }

            if (await _context.Users.AnyAsync(x => x.Email == email))
            {
                return Conflict(new { message = "Email đã tồn tại." });
            }

            if (await _context.Users.AnyAsync(x => x.Phone == phone))
            {
                return Conflict(new { message = "Số điện thoại đã tồn tại." });
            }

            var hasShop = !string.IsNullOrWhiteSpace(request.ShopName);
            var user = new User
            {
                FullName = fullName,
                ShopName = hasShop ? request.ShopName!.Trim() : null,
                Phone = phone,
                Email = email,
                PasswordHash = HashPassword(request.Password),
                Role = "customer",
                AccountType = hasShop ? "business" : "personal",
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đăng ký thành công.",
                id = user.Id.ToString(),
                name = user.FullName,
                role = user.Role,
                accountType = user.AccountType
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { message = "Vui lòng nhập email và mật khẩu." });
            }

            var email = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(x => x.Email == email);

            if (user == null || user.PasswordHash != HashPassword(request.Password))
            {
                return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });
            }

            var token = GenerateToken(user);

            return Ok(new
            {
                message = "Đăng nhập thành công",
                token,
                id = user.Id.ToString(),
                name = user.FullName,
                role = user.Role,
                accountType = user.AccountType
            });
        }

        // DEMO OTP: project chưa cấu hình nhà cung cấp SMS nên mã được trả về cho client ở môi trường bài tập.
        [HttpPost("forgot-password/request")]
        public async Task<IActionResult> RequestPasswordResetOtp([FromBody] ForgotPasswordRequest request)
        {
            var phone = request.Phone?.Trim() ?? string.Empty;
            if (!System.Text.RegularExpressions.Regex.IsMatch(phone, @"^0[0-9]{9}$"))
            {
                return BadRequest(new { message = "Số điện thoại phải gồm 10 số và bắt đầu bằng số 0." });
            }

            var userExists = await _context.Users.AnyAsync(x => x.Phone == phone);
            if (!userExists)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản với số điện thoại này." });
            }

            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            PasswordResetOtps[phone] = new PasswordResetOtp
            {
                Code = code,
                ExpiresAt = DateTime.UtcNow.AddMinutes(5),
                Attempts = 0
            };

            return Ok(new
            {
                message = "Mã OTP đã được tạo. Bản demo chưa tích hợp dịch vụ SMS nên mã hiển thị trực tiếp.",
                demoOtp = code,
                expiresInSeconds = 300
            });
        }

        [HttpPost("forgot-password/reset")]
        public async Task<IActionResult> ResetForgottenPassword([FromBody] ResetPasswordByOtpRequest request)
        {
            var phone = request.Phone?.Trim() ?? string.Empty;
            var otp = request.Otp?.Trim() ?? string.Empty;

            if (!System.Text.RegularExpressions.Regex.IsMatch(phone, @"^0[0-9]{9}$"))
                return BadRequest(new { message = "Số điện thoại không hợp lệ." });
            if (!System.Text.RegularExpressions.Regex.IsMatch(otp, @"^[0-9]{6}$"))
                return BadRequest(new { message = "Mã OTP phải gồm 6 số." });
            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
                return BadRequest(new { message = "Mật khẩu mới phải có ít nhất 8 ký tự." });

            if (!PasswordResetOtps.TryGetValue(phone, out var entry))
                return BadRequest(new { message = "Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng gửi mã mới." });

            if (entry.ExpiresAt <= DateTime.UtcNow)
            {
                PasswordResetOtps.TryRemove(phone, out _);
                return BadRequest(new { message = "Mã OTP đã hết hạn. Vui lòng gửi mã mới." });
            }

            entry.Attempts++;
            if (entry.Attempts > 5)
            {
                PasswordResetOtps.TryRemove(phone, out _);
                return BadRequest(new { message = "Bạn đã nhập sai OTP quá nhiều lần. Vui lòng gửi mã mới." });
            }

            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(entry.Code),
                    Encoding.UTF8.GetBytes(otp)))
            {
                return BadRequest(new { message = "Mã OTP không đúng." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(x => x.Phone == phone);
            if (user == null)
            {
                PasswordResetOtps.TryRemove(phone, out _);
                return NotFound(new { message = "Không tìm thấy tài khoản." });
            }

            user.PasswordHash = HashPassword(request.NewPassword);
            await _context.SaveChangesAsync();
            PasswordResetOtps.TryRemove(phone, out _);

            return Ok(new { message = "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới." });
        }

        [HttpPost("logout")]
        public IActionResult Logout()
        {
            return Ok(new { success = true, message = "Đăng xuất thành công." });
        }

        private string GenerateToken(User user)
        {
            var jwt = _configuration.GetSection("Jwt");
            var jwtKey = jwt["Key"];
            var jwtIssuer = jwt["Issuer"];
            var jwtAudience = jwt["Audience"];

            if (string.IsNullOrWhiteSpace(jwtKey))
                throw new InvalidOperationException("JWT Key chưa được cấu hình trong appsettings.json.");

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expireMinutes = 120;

            if (int.TryParse(jwt["ExpireMinutes"], out var configuredExpireMinutes))
                expireMinutes = configuredExpireMinutes;

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: DateTime.UtcNow.AddMinutes(expireMinutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static string HashPassword(string password)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
            return Convert.ToHexString(bytes);
        }

        public sealed class ForgotPasswordRequest
        {
            public string Phone { get; set; } = string.Empty;
        }

        public sealed class ResetPasswordByOtpRequest
        {
            public string Phone { get; set; } = string.Empty;
            public string Otp { get; set; } = string.Empty;
            public string NewPassword { get; set; } = string.Empty;
        }
    }
}
