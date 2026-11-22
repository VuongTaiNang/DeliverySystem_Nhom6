using Back_DeliverySystem.Data;
using Back_DeliverySystem.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;
using System.Text;
using System.Diagnostics;
using Back_DeliverySystem.Services;

namespace Back_DeliverySystem
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // JWT signing key is supplied through User Secrets (development)
            // or the Jwt__Key environment variable (deployment), never source control.
            var jwtSigningKey = builder.Configuration["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(jwtSigningKey) || Encoding.UTF8.GetByteCount(jwtSigningKey) < 32)
            {
                throw new InvalidOperationException(
                    "Missing or weak Jwt:Key. Configure dotnet user-secrets (development) or Jwt__Key (environment).");
            }

            // =====================================================
            // CONTROLLERS
            // =====================================================
            builder.Services.AddControllers(options =>
            {
                options.Filters.AddService<ShipmentAutoAssignmentFilter>();
            });

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
            builder.Services.AddScoped<ShipmentAutoAssignmentFilter>();


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
                                        jwtSigningKey
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


            // Measure the entire ASP.NET request pipeline in Development.
            // Logs omit query strings and request bodies to avoid leaking user data.
            if (app.Environment.IsDevelopment())
            {
                app.Use(async (context, next) =>
                {
                    var stopwatch = Stopwatch.StartNew();
                    context.Response.OnStarting(() =>
                    {
                        context.Response.Headers["Server-Timing"] =
                            $"app;dur={stopwatch.Elapsed.TotalMilliseconds:F0}";
                        return Task.CompletedTask;
                    });

                    try
                    {
                        await next();
                    }
                    finally
                    {
                        stopwatch.Stop();
                        var duration = stopwatch.Elapsed.TotalMilliseconds;
                        if (duration >= 1000)
                        {
                            app.Logger.LogWarning(
                                "SLOW API {Method} {Path}: {DurationMs:F0} ms, HTTP {StatusCode}, aborted={Aborted}",
                                context.Request.Method,
                                context.Request.Path.Value,
                                duration,
                                context.Response.StatusCode,
                                context.RequestAborted.IsCancellationRequested
                            );
                        }
                    }
                });
            }

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

            // Sprint 3: phường/xã/đặc khu + StaffArea + capacity.
            await Sprint3SeedData.InitializeAsync(
                app.Services
            );


            // =====================================================
            // RUN
            // =====================================================
            await app.RunAsync();
        }
    }
}
