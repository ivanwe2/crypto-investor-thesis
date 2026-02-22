using Asp.Versioning;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using TradeEngine.Api.Middleware.ExceptionHandling;
using TradeEngine.Api.Services;
using TradeEngine.Application.Constants;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Messaging;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services;
using TradeEngine.Infrastructure.SignalR.Services;

namespace TradeEngine.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        services.AddDbContext<TradeEngineDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddHostedService<RabbitMqListener>();

        services.AddHttpClient<IAiAnalyst, HttpAiAnalyst>(client =>
        {
            string aiUrl = configuration[AiAnalystConstants.UrlConfigKey] 
                           ?? AiAnalystConstants.DefaultUrl;
            client.BaseAddress = new Uri(aiUrl);

            string apiKey = configuration[AiAnalystConstants.ApiKeyConfigKey]
                            ?? AiAnalystConstants.DefaultApiKey;
            client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        });

        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IWalletService, WalletService>();
        services.AddScoped<IMatchingEngine, MatchingEngine>();

        return services;
    }

    public static IServiceCollection AddSecurityServices(this IServiceCollection services, IConfiguration configuration)
    {
        var jwtSecret = configuration[JwtConstants.ConfigKey] ?? JwtConstants.DefaultSecret;

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = JwtConstants.Issuer,
                    ValidAudience = JwtConstants.Audience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
                };

                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization();

        services.AddCors(options =>
        {
            options.AddPolicy("ReactClient", policy =>
            {
                policy.WithOrigins("http://localhost:3000")
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        services.AddScoped<IAuthService, AuthService>();

        return services;
    }

    public static IServiceCollection AddPresentationServices(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        services.AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
            options.ApiVersionReader = new UrlSegmentApiVersionReader();
        }).AddApiExplorer(options =>
        {
            // Format the version as "'v'major[.minor]" (e.g., v1)
            options.GroupNameFormat = "'v'V";
            options.SubstituteApiVersionInUrl = true;
        });

        services.AddSignalR();
        services.AddSingleton<IPriceBroadcaster, SignalRPriceBroadcaster>();
        services.AddSingleton<ITradeNotifier, SignalRTradeNotifier>();

        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        services.AddHealthChecks()
                .AddDbContextCheck<TradeEngineDbContext>();

        return services;
    }
}