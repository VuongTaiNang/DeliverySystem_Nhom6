using Back_DeliverySystem.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Back_DeliverySystem.Data
{
    public static class SeedData
    {
        public static async Task InitializeAsync(
            IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<AppDbContext>();

            await SeedOperationsAsync(context);
            await SeedStaffAsync(context);
            await SeedStaffProfilesAsync(context);
        }

        // =========================================================
        // SEED OPERATIONS
        // =========================================================
        private static async Task SeedOperationsAsync(
            AppDbContext context)
        {
            const string email = "operations@express.com";

            var existed = await context.Users
                .AnyAsync(x => x.Email == email);

            if (existed)
            {
                return;
            }

            var operations = new User
            {
                FullName = "Express Operations",

                ShopName = null,

                Phone = "0900000001",

                Email = email,

                PasswordHash =
                    HashPassword("Operations@123"),

                Role = "operations",

                AccountType = "internal",

                CreatedAt = DateTime.UtcNow
            };

            context.Users.Add(operations);

            await context.SaveChangesAsync();
        }

        // =========================================================
        // SEED STAFF ACCOUNT
        // Tạo tài khoản đăng nhập cho Staff
        // =========================================================
        private static async Task SeedStaffAsync(
            AppDbContext context)
        {
            var staffs = new[]
            {
                new User
                {
                    FullName = "Nguyễn Minh Đức",

                    ShopName = null,

                    Phone = "0900000011",

                    Email = "staff01@express.com",

                    PasswordHash =
                        HashPassword("Staff@123"),

                    Role = "staff",

                    AccountType = "internal",

                    CreatedAt = DateTime.UtcNow
                },

                new User
                {
                    FullName = "Trần Quốc Huy",

                    ShopName = null,

                    Phone = "0900000012",

                    Email = "staff02@express.com",

                    PasswordHash =
                        HashPassword("Staff@123"),

                    Role = "staff",

                    AccountType = "internal",

                    CreatedAt = DateTime.UtcNow
                }
            };

            var emails = staffs.Select(staff => staff.Email).ToArray();
            var existingEmails = (await context.Users
                    .AsNoTracking()
                    .Where(user => emails.Contains(user.Email))
                    .Select(user => user.Email)
                    .ToListAsync())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var staff in staffs)
            {
                if (!existingEmails.Contains(staff.Email))
                {
                    context.Users.Add(staff);
                }
            }

            await context.SaveChangesAsync();
        }

        // =========================================================
        // SEED STAFF PROFILE
        // Tạo hồ sơ nghiệp vụ cho các User có Role = staff
        // =========================================================
        private static async Task SeedStaffProfilesAsync(
            AppDbContext context)
        {
            var staffUsers = await context.Users
                .Where(x => x.Role == "staff")
                .ToListAsync();

            var userIds = staffUsers.Select(user => user.Id).ToArray();
            var usersWithProfile = (await context.Staffs
                    .AsNoTracking()
                    .Where(staff => userIds.Contains(staff.UserId))
                    .Select(staff => staff.UserId)
                    .ToListAsync())
                .ToHashSet();

            foreach (var user in staffUsers)
            {
                if (usersWithProfile.Contains(user.Id))
                {
                    continue;
                }

                var staff = new Staff
                {
                    UserId = user.Id,

                    // Mã tạm phải <= 20 ký tự
                    // Ví dụ: TMP7F3A91B4C2D8
                    EmployeeCode =
                        GenerateTemporaryEmployeeCode(),

                    Area = "Chưa phân công",

                    Status = "available",

                    IsAvailable = true,

                    CreatedAt = DateTime.UtcNow
                };

                context.Staffs.Add(staff);

                // Lưu lần đầu để SQL tạo Staff.Id
                await context.SaveChangesAsync();

                // Sau khi đã có Id thì đổi sang mã chính thức
                // Ví dụ: STF0001
                staff.EmployeeCode =
                    $"STF{staff.Id:0000}";

                await context.SaveChangesAsync();
            }
        }

        // =========================================================
        // TẠO MÃ NHÂN VIÊN TẠM
        // =========================================================
        private static string GenerateTemporaryEmployeeCode()
        {
            // "TMP" + 12 ký tự Guid = 15 ký tự
            // Không vượt EmployeeCode varchar/nvarchar(20)

            return "TMP" +
                Guid.NewGuid()
                    .ToString("N")
                    .Substring(0, 12)
                    .ToUpperInvariant();
        }

        // =========================================================
        // HASH PASSWORD
        // Phải giống AuthController
        // =========================================================
        private static string HashPassword(
            string password)
        {
            using var sha256 = SHA256.Create();

            var bytes = sha256.ComputeHash(
                Encoding.UTF8.GetBytes(password)
            );

            return Convert.ToHexString(bytes);
        }
    }
}