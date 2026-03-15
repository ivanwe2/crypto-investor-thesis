using System.Diagnostics;
using Asp.Versioning;
using Grpc.Core;
using Marketgateway.V1;
using Polly.CircuitBreaker;
using StackExchange.Redis;
using TradeEngine.Api.Endpoints;
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
            SignalRConnectionTracker signalRTracker) => 
        {
            var sw = Stopwatch.StartNew();

            // 1. Check PostgreSQL
            bool isDbHealthy = await db.Database.CanConnectAsync();

            // 2. Check Redis
            bool isRedisHealthy = redis.IsConnected;

            // 3. Check Go gRPC Gateway (by asking for a snapshot of BTC)
            string grpcStatus = "Disconnected";
            try 
            {
                // Give it a 1 second timeout so it doesn't hang the dashboard
                var deadline = DateTime.UtcNow.AddSeconds(1);
                var ping = await grpcClient.GetMarketSnapshotAsync(
                    new SnapshotRequest { Symbol = "BTCUSDT" }, 
                    deadline: deadline);
                
                grpcStatus = "Connected";
            } 
            catch (RpcException) 
            {
                grpcStatus = "Unreachable";
            }

            sw.Stop();

            // Aggregate Response
            var healthReport = new 
            {
                Status = isDbHealthy && isRedisHealthy ? "Healthy" : "Degraded",
                Uptime = TimeSpan.FromMilliseconds(Environment.TickCount64).ToString(@"dd\.hh\:mm\:ss"),
                ResponseTimeMs = sw.ElapsedMilliseconds,
                Components = new 
                {
                    PostgreSQL = isDbHealthy ? "Up" : "Down",
                    RedisReadModel = isRedisHealthy ? "Up" : "Down",
                    GoMarketGateway = grpcStatus,
                    AiCircuitBreaker = aiCircuitBreaker.CircuitState.ToString(), // e.g. "Closed", "Open", "HalfOpen"
                    ActiveSignalRConnections = signalRTracker.CurrentConnections
                }
            };

            return Results.Ok(healthReport);
        })
        .WithName("GetSystemHealth")
        .WithSummary("Aggregated system observability metrics for the Admin Dashboard");
    }
}