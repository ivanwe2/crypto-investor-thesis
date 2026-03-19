using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
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
                await grpcClient.GetMarketSnapshotAsync(new SnapshotRequest { Symbol = "BTCUSDT" }, deadline: deadline);
                grpcStatus = "Connected";
            } 
            catch (RpcException ex) { grpcStatus = $"gRPC Error: {ex.StatusCode}"; }

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
                else goMetrics = goMetrics with { Status = $"HTTP {goResponse.StatusCode}" };
            }
            catch (Exception ex) { goMetrics = goMetrics with { Status = ex.Message }; }

            string aiStatus = "Unreachable";
            try
            {
                var aiHealthUrl = config[AiAnalystConstants.HealthUrlConfigKey] ?? AiAnalystConstants.DefaultHealthUrl;
                var aiResponse = await httpClient.GetAsync(aiHealthUrl);
                aiStatus = aiResponse.IsSuccessStatusCode ? "Online" : $"HTTP {aiResponse.StatusCode}";
            }
            catch (Exception ex) { aiStatus = ex.Message; }

            int tradeEventsQueueDepth = 0;
            double messageRate = 0;
            string rabbitStatus = "Unreachable";
            try
            {
                var rabbitUrl = config[RabbitMqConstants.ManagementUrlConfigKey] ?? RabbitMqConstants.DefaultManagementUrl;
                var rabbitUser = config[RabbitMqConstants.UsernameConfigKey] ?? RabbitMqConstants.DefaultUsername;
                var rabbitPass = config[RabbitMqConstants.PasswordConfigKey] ?? RabbitMqConstants.DefaultPassword;

                var request = new HttpRequestMessage(HttpMethod.Get, rabbitUrl);
                var authString = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{rabbitUser}:{rabbitPass}"));
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", authString);

                var rabbitResp = await httpClient.SendAsync(request);
                if (rabbitResp.IsSuccessStatusCode)
                {
                    var rabbitContent = await rabbitResp.Content.ReadAsStringAsync();
                    var parsed = JsonSerializer.Deserialize<JsonElement>(rabbitContent);
                    
                    // Get Backlog (Traffic Jam)
                    if (parsed.TryGetProperty("messages_ready", out var messages))
                    {
                        tradeEventsQueueDepth = messages.GetInt32();
                    }
                    
                    // Get Throughput (Speedometer)
                    if (parsed.TryGetProperty("message_stats", out var stats))
                    {
                        if (stats.TryGetProperty("deliver_get_details", out var deliverDetails) && 
                            deliverDetails.TryGetProperty("rate", out var rate))
                        {
                            messageRate = rate.GetDouble();
                        }
                        else if (stats.TryGetProperty("publish_details", out var pubDetails) && 
                                 pubDetails.TryGetProperty("rate", out var pubRate))
                        {
                            messageRate = pubRate.GetDouble();
                        }
                    }
                    
                    rabbitStatus = "Online";
                }
                else
                {
                    rabbitStatus = $"HTTP {rabbitResp.StatusCode}";
                }
            }
            catch (Exception ex) 
            { 
                rabbitStatus = ex.Message; 
            }

            ThreadPool.GetAvailableThreads(out int workerThreads, out int _);
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
                    RabbitMqMessageRate = Math.Round(messageRate, 1),
                    AiAnalyst = aiStatus,
                    AiCircuitBreaker = aiCircuitBreaker.CircuitState.ToString(),
                    GoMarketGateway = grpcStatus 
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