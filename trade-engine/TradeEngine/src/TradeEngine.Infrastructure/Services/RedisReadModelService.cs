using System.Diagnostics.Metrics;
using System.Text.Json;
using StackExchange.Redis;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.Services;

public class RedisReadModelService : IRedisReadModelService
{
    private readonly IDatabase _redisDb;
    private readonly Counter<int> _cacheHitCounter;
    private readonly Counter<int> _cacheMissCounter;

    public RedisReadModelService(IConnectionMultiplexer redis, IMeterFactory meterFactory)
    {
        _redisDb = redis.GetDatabase();
        
        // 📊 Initialize OpenTelemetry Metrics for Grafana
        var meter = meterFactory.Create("TradeEngine.RedisCQRS");
        _cacheHitCounter = meter.CreateCounter<int>("redis_cache_hits", description: "Number of successful Redis read model hits");
        _cacheMissCounter = meter.CreateCounter<int>("redis_cache_misses", description: "Number of Redis read model misses");
    }

    private static string GetPortfolioKey(Guid userId) => $"portfolio:{userId}";

    public async Task<WalletResponse?> GetUserPortfolioAsync(Guid userId, CancellationToken ct = default)
    {
        var key = GetPortfolioKey(userId);
        var cachedData = await _redisDb.StringGetAsync(key);

        if (cachedData.HasValue)
        {
            RecordCacheHit();
            return JsonSerializer.Deserialize<WalletResponse>((ReadOnlySpan<byte>)cachedData);
        }

        RecordCacheMiss();
        return null;
    }

    public async Task UpdateUserPortfolioAsync(Guid userId, WalletResponse portfolio, CancellationToken ct = default)
    {
        var key = GetPortfolioKey(userId);
        var jsonData = JsonSerializer.Serialize(portfolio);
        
        // Store the projection. In a real system, you might set an expiry, 
        // but for an event-sourced read model, it lives as long as the state is valid.
        await _redisDb.StringSetAsync(key, jsonData);
    }

    public void RecordCacheHit() => _cacheHitCounter.Add(1);
    public void RecordCacheMiss() => _cacheMissCounter.Add(1);
}