using Asp.Versioning;
using Marketgateway.V1;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Polly;
using Polly.CircuitBreaker;
using Polly.Extensions.Http;
using StackExchange.Redis;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using TradeEngine.Api.Middleware.ExceptionHandling;
using TradeEngine.Api.Services;
using TradeEngine.Application.Constants;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.BackgroundServices.Messaging;
using TradeEngine.Infrastructure.BackgroundServices.OrderMatching;
using TradeEngine.Infrastructure.BackgroundServices.OutboxProcessor;
using TradeEngine.Infrastructure.BackgroundServices.TradeSettlement;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services;
using TradeEngine.Infrastructure.Services.Messaging;
using TradeEngine.Infrastructure.Services.Orders;
using TradeEngine.Infrastructure.Services.TradeSettlement;
using TradeEngine.Infrastructure.SignalR.Providers;
using TradeEngine.Infrastructure.SignalR.Services;

namespace TradeEngine.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        services.AddDbContextPool<TradeEngineDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsqlOptionsAction =>
            {
                npgsqlOptionsAction.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(5),
                    errorCodesToAdd: null);
            });
        }, poolSize: 1024);

        var redisConnectionString = configuration.GetConnectionString("Redis") ?? "redis:6379";
        services.AddSingleton<IConnectionMultiplexer>(sp => ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddSingleton<IRedisReadModelService, RedisReadModelService>();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<PlaceOrderRequest>());

        services.AddMemoryCache();
        services.AddSingleton<IMarketStateCache, MarketStateCache>();
        services.AddSingleton<SettlementQueue>();
        services.AddSingleton<IOrderIngressQueue, OrderIngressQueue>();
        services.AddSingleton<IMessagePublisher, RabbitMqPublisher>();
        services.AddSingleton<IMarketEventBus, MarketEventBus>();
        services.AddSingleton<DormantOrderTracker>();
        services.AddHostedService<RabbitMqListener>();
        services.AddHostedService<AiSignalListener>();
        services.AddHostedService<OrderMatchingWorker>();
        services.AddHostedService<TradeSettlementWorker>();
        services.AddHostedService<OutboxProcessorWorker>();

        services.AddScoped<ITradeEngineDbContext>(provider => 
            provider.GetRequiredService<TradeEngineDbContext>());

        services.AddGrpcClient<MarketDataService.MarketDataServiceClient>(options =>
        {
            var gatewayUrl = configuration[MarketGatewayConstants.UrlConfigKey] 
                             ?? MarketGatewayConstants.DefaultUrl;
            options.Address = new Uri(gatewayUrl);
        });
        
        var aiCircuitBreaker = HttpPolicyExtensions
            .HandleTransientHttpError()
            .CircuitBreakerAsync(3, TimeSpan.FromSeconds(30));

        services.AddSingleton<AsyncCircuitBreakerPolicy<HttpResponseMessage>>(aiCircuitBreaker);

        services.AddHttpClient<IAiAnalyst, HttpAiAnalyst>(client =>
        {
            string aiUrl = configuration[AiAnalystConstants.UrlConfigKey] ?? AiAnalystConstants.DefaultUrl;
            client.BaseAddress = new Uri(aiUrl);
            string apiKey = configuration[AiAnalystConstants.ApiKeyConfigKey] ?? AiAnalystConstants.DefaultApiKey;
            client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        })
        .AddPolicyHandler(GetRetryPolicy())
        .AddPolicyHandler(aiCircuitBreaker);

        return services;

        static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
        {
            return HttpPolicyExtensions
                .HandleTransientHttpError()
                .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
        }
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
        services.AddSingleton<SignalRConnectionTracker>();
        services.AddSingleton<IPriceBroadcaster, SignalRPriceBroadcaster>();
        services.AddSingleton<ITradeNotifier, SignalRTradeNotifier>();
        services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();

        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        services.AddHealthChecks()
                .AddDbContextCheck<TradeEngineDbContext>();

        return services;
    }

    public static IServiceCollection AddObservabilityServices(this IServiceCollection services, IConfiguration configuration)
    {
        var otlpEndpoint = configuration[ObservabilityConstants.OtlpEndpointConfigKey] 
                           ?? ObservabilityConstants.DefaultOtlpEndpoint;
                           
        var serviceName = configuration[ObservabilityConstants.ServiceNameConfigKey] 
                           ?? ObservabilityConstants.ServiceName;
                           
        var serviceVersion = configuration[ObservabilityConstants.ServiceVersionConfigKey] 
                             ?? ObservabilityConstants.ServiceVersion;

        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(
                serviceName: serviceName,
                serviceVersion: serviceVersion))
            .WithTracing(tracing =>
            {
                tracing
                    .AddSource("TradeEngine")
                    .AddSource("Microsoft.AspNetCore") 
                    .AddSource("System.Net.Http")      
                    .AddSource("Npgsql")
                    .AddEntityFrameworkCoreInstrumentation()
                    .AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(otlpEndpoint);
                    });
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddMeter("Microsoft.AspNetCore.Hosting")
                    .AddMeter("Microsoft.AspNetCore.Server.Kestrel")
                    .AddMeter("System.Net.Http")
                    .AddMeter("TradeEngine.RedisCQRS")
                    .AddRuntimeInstrumentation()
                    .AddOtlpExporter(options =>
                    {
                        options.Endpoint = new Uri(otlpEndpoint);
                    });
            });

        return services;
    }

    public static IServiceCollection AddRateLimitingServices(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                await context.HttpContext.Response.WriteAsJsonAsync(new
                {
                    Type = "https://tools.ietf.org/html/rfc6585#section-4",
                    Title = "Too Many Requests",
                    Status = 429,
                    Detail = "Rate limit exceeded. To protect the matching engine, you are limited to 10 requests per second."
                }, cancellationToken: token);
            };

            options.AddPolicy(PolicyConstants.OrderPlacement, httpContext =>
            {
                var userId = httpContext.User?.FindFirstValue(ClaimTypes.NameIdentifier) 
                              ?? httpContext.User?.FindFirstValue("sub");

                var partitionKey = !string.IsNullOrEmpty(userId) 
                    ? userId 
                    : httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous";

                return RateLimitPartition.GetTokenBucketLimiter(partitionKey, _ =>
                    new TokenBucketRateLimiterOptions
                    {
                        TokenLimit = 10,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = 0,
                        ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                        TokensPerPeriod = 10,
                        AutoReplenishment = true,
                    });
            });
        });

        return services;
    }
}