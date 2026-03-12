using System.Diagnostics.Metrics;
using System.Text.Json;
using StackExchange.Redis;
using TradeEngine.Application.DTOs.Order;
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
        
        var meter = meterFactory.Create("TradeEngine.RedisCQRS");
        _cacheHitCounter = meter.CreateCounter<int>("redis_cache_hits", description: "Number of successful Redis read model hits");
        _cacheMissCounter = meter.CreateCounter<int>("redis_cache_misses", description: "Number of Redis read model misses");
    }

    private static string GetPortfolioKey(Guid userId) => $"portfolio:{userId}";
    private static string GetOrdersKey(Guid userId) => $"orders:open:{userId}";

    public async Task<WalletResponse?> GetUserPortfolioAsync(Guid userId, CancellationToken ct = default)
    {
        var key = GetPortfolioKey(userId);
        var cachedData = await _redisDb.StringGetAsync(key);

        if (cachedData.HasValue)
        {
            RecordCacheHit();
            return JsonSerializer.Deserialize<WalletResponse>((ReadOnlySpan<byte>)cachedData!);
        }

        RecordCacheMiss();
        return null;
    }

    public async Task UpdateUserPortfolioAsync(Guid userId, WalletResponse portfolio, CancellationToken ct = default)
    {
        var key = GetPortfolioKey(userId);
        var jsonData = JsonSerializer.Serialize(portfolio);
        
        await _redisDb.StringSetAsync(key, jsonData);
    }

    public async Task<List<OpenOrderDto>?> GetOpenOrdersAsync(Guid userId, CancellationToken ct = default)
    {
        var key = GetOrdersKey(userId);
        var cachedData = await _redisDb.StringGetAsync(key);

        if (cachedData.HasValue)
        {
            RecordCacheHit();
            return JsonSerializer.Deserialize<List<OpenOrderDto>>((ReadOnlySpan<byte>)cachedData!);
        }

        RecordCacheMiss();
        return null;
    }

    public async Task UpdateOpenOrdersAsync(Guid userId, List<OpenOrderDto> orders, CancellationToken ct = default)
    {
        var key = GetOrdersKey(userId);
        var jsonData = JsonSerializer.Serialize(orders);
        await _redisDb.StringSetAsync(key, jsonData);
    }

    public async Task AddOpenOrderAsync(Guid userId, OpenOrderDto order, CancellationToken ct = default)
    {
        var key = GetOrdersKey(userId);
        var cachedData = await _redisDb.StringGetAsync(key);

        var orders = cachedData.HasValue 
            ? JsonSerializer.Deserialize<List<OpenOrderDto>>((ReadOnlySpan<byte>)cachedData!) ?? new List<OpenOrderDto>()
            : new List<OpenOrderDto>();

        orders.Add(order);

        var jsonData = JsonSerializer.Serialize(orders);
        await _redisDb.StringSetAsync(key, jsonData);
    }

    public async Task RemoveOpenOrderAsync(Guid userId, Guid orderId, CancellationToken ct = default)
    {
        var key = GetOrdersKey(userId);
        var cachedData = await _redisDb.StringGetAsync(key);

        if (!cachedData.HasValue) return;

        var orders = JsonSerializer.Deserialize<List<OpenOrderDto>>((ReadOnlySpan<byte>)cachedData!);
        if (orders == null) return;

        var initialCount = orders.Count;
        orders.RemoveAll(o => o.Id == orderId); // Find and remove the target order

        // Only incur the network write if something was actually removed
        if (orders.Count != initialCount)
        {
            var jsonData = JsonSerializer.Serialize(orders);
            await _redisDb.StringSetAsync(key, jsonData);
        }
    }
    
    public void RecordCacheHit() => _cacheHitCounter.Add(1);
    public void RecordCacheMiss() => _cacheMissCounter.Add(1);
}