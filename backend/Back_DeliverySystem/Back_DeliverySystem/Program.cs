using Back_DeliverySystem.Data;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;
using Back_DeliverySystem.Services;

namespace Back_DeliverySystem
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // =====================================================
            // CONTROLLERS
            // =====================================================
            builder.Services.AddControllers();

            builder.Services.AddOpenApi();


            // =====================================================
            // VNPAY CONFIGURATION
            // =====================================================
            builder.Services.Configure<VnPayOptions>(
                builder.Configuration.GetSection("VnPay")
            );

            builder.Services.AddScoped<IVnPayService, VnPayService>();

            // Tự động phân Staff theo phường/xã/đặc khu và tải hiện tại.
            builder.Services.AddScoped<IAutoAssignmentService, AutoAssignmentService>();


            // =====================================================
            // DATABASE
            // =====================================================
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(
                    builder.Configuration.GetConnectionString(
                        "DeliverySystemConnection"
                    )
                ));


            // =====================================================
            // JWT AUTHENTICATION
            // =====================================================
            builder.Services
                .AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme =
                        JwtBearerDefaults.AuthenticationScheme;

                    options.DefaultChallengeScheme =
                        JwtBearerDefaults.AuthenticationScheme;
                })
                .AddJwtBearer(options =>
                {
                    var jwt =
                        builder.Configuration.GetSection("Jwt");

                    options.TokenValidationParameters =
                        new TokenValidationParameters
                        {
                            ValidateIssuer = true,
                            ValidateAudience = true,
                            ValidateLifetime = true,
                            ValidateIssuerSigningKey = true,

                            ValidIssuer =
                                jwt["Issuer"],

                            ValidAudience =
                                jwt["Audience"],

                            IssuerSigningKey =
                                new SymmetricSecurityKey(
                                    Encoding.UTF8.GetBytes(
                                        jwt["Key"]!
                                    )
                                ),

                            ClockSkew =
                                TimeSpan.Zero
                        };
                });


            // =====================================================
            // CORS
            // Cho phép React Web + Flutter Web gọi Backend
            // =====================================================
            builder.Services.AddCors(options =>
            {
                options.AddPolicy(
                    "AlowFrontend",
                    policy =>
                    {
                        policy
                            .SetIsOriginAllowed(origin =>
                                Uri.TryCreate(
                                    origin,
                                    UriKind.Absolute,
                                    out var uri
                                ) &&
                                uri.Host == "localhost"
                            )
                            .AllowCredentials()
                            .AllowAnyHeader()
                            .AllowAnyMethod();
                    }
                );
            });


            var app =
                builder.Build();


            // =====================================================
            // OPENAPI + SCALAR
            // =====================================================
            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();

                app.MapScalarApiReference();
            }


            // =====================================================
            // MIDDLEWARE
            // =====================================================

            // Hiện tại đang dùng HTTP localhost + ngrok
            // nên giữ comment dòng này.
            // app.UseHttpsRedirection();

            app.UseCors(
                "AlowFrontend"
            );

            app.UseAuthentication();

            app.UseAuthorization();


            // =====================================================
            // CONTROLLERS
            // =====================================================
            app.MapControllers();


            // =====================================================
            // SEED DATA
            // =====================================================
            await SeedData.InitializeAsync(
                app.Services
            );


            // =====================================================
            // RUN
            // =====================================================
            await app.RunAsync();
        }
    }
}