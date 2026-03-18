using System.Diagnostics;
using System.Text.Json;
using Asp.Versioning;
using Grpc.Core;
using Marketgateway.V1;
using Polly.CircuitBreaker;
using StackExchange.Redis;
using TradeEngine.Api.Endpoints;
using TradeEngine.Application.Constants;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.SignalR.Services;

namespace TradeEngine.Api.Extensions;

public static class EndpointExtensions
{
    public static IEndpointRouteBuilder MapAllEndpoints(this IEndpointRouteBuilder app)
    {
        var apiVersionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1))
            .ReportApiVersions()
            .Build();

        // 2. Create a versioned route group: /api/v1
        var versionedGroup = app.MapGroup("/api/v{version:apiVersion}")
                                .WithApiVersionSet(apiVersionSet);

        // 3. Map all endpoints UNDER the versioned group
        versionedGroup.MapAnalysisEndpoints();
        versionedGroup.MapAuthEndpoints();
        versionedGroup.MapOrderEndpoints();
        versionedGroup.MapWalletEndpoints();
        versionedGroup.MapMarketEndpoints();
        versionedGroup.MapSystemEndpoints();

        // 4. Map infrastructure endpoints OUTSIDE the versioned group
        app.MapHealthChecks("/healthz");

        return app;
    }

    public static void MapSystemEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/system").WithTags("System Health");

        group.MapGet("/health", async (
            TradeEngineDbContext db,
            IConnectionMultiplexer redis,
            MarketDataService.MarketDataServiceClient grpcClient,
            AsyncCircuitBreakerPolicy<HttpResponseMessage> aiCircuitBreaker,
            SignalRConnectionTracker signalRTracker,
            IHttpClientFactory httpClientFactory,
            IConfiguration config) => 
        {
            var sw = Stopwatch.StartNew();
            using var httpClient = httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(2); 

            bool isDbHealthy = await db.Database.CanConnectAsync();

            bool isRedisHealthy = redis.IsConnected;

            string grpcStatus = "Disconnected";
            try 
            {
                var deadline = DateTime.UtcNow.AddSeconds(1);
                await grpcClient.GetMarketSnapshotAsync(
                    new SnapshotRequest { Symbol = "BTCUSDT" }, 
                    deadline: deadline);
                grpcStatus = "Connected";
            } 
            catch (RpcException) { grpcStatus = "Unreachable"; }

            var goMetrics = new { Goroutines = 0, MemoryAllocMb = 0, MemorySysMb = 0, Status = "Offline" };
            try
            {
                var goHealthUrl = config[MarketGatewayConstants.HealthUrlConfigKey] ?? MarketGatewayConstants.DefaultHealthUrl;
                var goResponse = await httpClient.GetAsync(goHealthUrl);
                if (goResponse.IsSuccessStatusCode)
                {
                    var goContent = await goResponse.Content.ReadAsStringAsync();
                    var parsed = JsonSerializer.Deserialize<JsonElement>(goContent);
                    goMetrics = new 
                    { 
                        Goroutines = parsed.GetProperty("goroutines").GetInt32(),
                        MemoryAllocMb = parsed.GetProperty("memoryAllocMb").GetInt32(),
                        MemorySysMb = parsed.GetProperty("memorySysMb").GetInt32(),
                        Status = "Online"
                    };
                }
            }
            catch { /* Ignore, defaults to Offline */ }

            string aiStatus = "Unreachable";
            try
            {
                var aiHealthUrl = config[AiAnalystConstants.HealthUrlConfigKey] ?? AiAnalystConstants.DefaultHealthUrl;
                var aiResponse = await httpClient.GetAsync(aiHealthUrl);
                if (aiResponse.IsSuccessStatusCode)
                {
                    aiStatus = "Online";
                }
            }
            catch { /* Ignore, defaults to Unreachable */ }

            int tradeEventsQueueDepth = 0;
            string rabbitStatus = "Unreachable";
            try
            {
                var rabbitUrl = config[RabbitMqConstants.ManagementUrlConfigKey] ?? RabbitMqConstants.DefaultManagementUrl;
                var rabbitResp = await httpClient.GetAsync(rabbitUrl);
                if (rabbitResp.IsSuccessStatusCode)
                {
                    var rabbitContent = await rabbitResp.Content.ReadAsStringAsync();
                    var parsed = JsonSerializer.Deserialize<JsonElement>(rabbitContent);
                    if (parsed.TryGetProperty("messages_ready", out var messages))
                    {
                        tradeEventsQueueDepth = messages.GetInt32();
                    }
                    rabbitStatus = "Online";
                }
            }
            catch { /* Ignore, defaults to 0 and Unreachable */ }

            ThreadPool.GetAvailableThreads(out int workerThreads, out int completionPortThreads);
            var process = Process.GetCurrentProcess();

            sw.Stop();

            var healthReport = new 
            {
                Status = isDbHealthy && isRedisHealthy && grpcStatus == "Connected" ? "Healthy" : "Degraded",
                Uptime = TimeSpan.FromMilliseconds(Environment.TickCount64).ToString(@"dd\.hh\:mm\:ss"),
                ResponseTimeMs = sw.ElapsedMilliseconds,
                
                Infrastructure = new 
                {
                    PostgreSQL = isDbHealthy ? "Up" : "Down",
                    Redis = isRedisHealthy ? "Up" : "Down",
                    RabbitMQ = rabbitStatus,
                    RabbitMqTradeEventsQueueDepth = tradeEventsQueueDepth,
                    AiAnalyst = aiStatus,
                    AiCircuitBreaker = aiCircuitBreaker.CircuitState.ToString()
                },

                DotNetMetrics = new
                {
                    ActiveSignalRConnections = signalRTracker.CurrentConnections,
                    MemoryWorkingSetMb = process.WorkingSet64 / 1024 / 1024,
                    GarbageCollectionAllocatedMb = GC.GetTotalMemory(false) / 1024 / 1024,
                    AvailableWorkerThreads = workerThreads
                },

                GoGatewayMetrics = goMetrics
            };

            return Results.Ok(healthReport);
        })
        .WithName("GetSystemHealth")
        .WithSummary("Aggregated system observability metrics for the Admin Dashboard");
    }
}