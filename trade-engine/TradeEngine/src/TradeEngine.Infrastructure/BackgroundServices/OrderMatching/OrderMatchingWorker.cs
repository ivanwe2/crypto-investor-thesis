using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services;
using TradeEngine.Infrastructure.Services.TradeSettlement;

namespace TradeEngine.Infrastructure.BackgroundServices.OrderMatching;

public class OrderMatchingWorker(
    IServiceScopeFactory scopeFactory,
    IMarketStateCache marketCache,
    SettlementQueue settlementQueue,
    IMemoryCache memoryCache,
    ILogger<OrderMatchingWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("🚀 High-Frequency Order Matcher started.");
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var latestPrices = marketCache.GetLatestPrices();
            if (!latestPrices.Any()) continue;

            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<TradeEngineDbContext>();
            
            // Read-Only query. Extremely fast.
            var pendingOrders = await db.Orders
                .Where(o => o.Status == OrderStatus.Pending)
                .AsNoTracking() 
                .ToListAsync(stoppingToken);

            foreach (var order in pendingOrders)
            {
                // ✨ Prefix the key to avoid collisions with other things in the global DI Memory Cache
                string cacheKeyStr = $"dispatched_order_{order.Id}";

                // Skip if we already queued it (checks the DI cache)
                if (memoryCache.TryGetValue(cacheKeyStr, out _)) continue;

                var cacheKey = latestPrices.Keys.FirstOrDefault(k => k.Equals(order.Symbol, StringComparison.OrdinalIgnoreCase));
                if (cacheKey == null) continue;

                decimal currentPrice = latestPrices[cacheKey];
                bool isBuyMatch = order.Side == OrderSide.Buy && currentPrice <= order.TargetPrice;
                bool isSellMatch = order.Side == OrderSide.Sell && currentPrice >= order.TargetPrice;

                if (isBuyMatch || isSellMatch)
                {
                    logger.LogInformation("🎯 Match Detected! Queuing Order {Id} for Settlement.", order.Id);
                    
                    // Mark as dispatched with a 1-minute absolute expiration.
                    memoryCache.Set(cacheKeyStr, (byte)1, TimeSpan.FromMinutes(1));
                    
                    settlementQueue.Writer.TryWrite(new TradeSettlementCommand(order.Id, currentPrice));
                }
            }
        }
    }
}