using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services.TradeSettlement;

namespace TradeEngine.Infrastructure.BackgroundServices.OrderMatching;

public class OrderMatchingWorker(
    IServiceScopeFactory scopeFactory,
    SettlementQueue settlementQueue,
    IOrderIngressQueue ingressQueue,
    IMarketEventBus marketEventBus,
    ILogger<OrderMatchingWorker> logger) : BackgroundService
{
    // Thesis Angle 14: Replaced nested standard Dictionary with ConcurrentDictionary to eradicate lock contention
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, Order>> _localOrderBook = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("🚀 Ultimate HFT Event-Driven Order Matcher started (Lock-Free O(1) Optimized).");

        await LoadInitialOrdersAsync(stoppingToken);

        var ingressTask = ListenForNewOrdersAsync(stoppingToken);
        var matchTask = ProcessMarketTicksAsync(stoppingToken);

        await Task.WhenAll(ingressTask, matchTask);
    }

    private async Task LoadInitialOrdersAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TradeEngineDbContext>();
        
        var pendingOrders = await db.Orders
            .Where(o => o.Status == OrderStatus.Pending)
            .AsNoTracking()
            .ToListAsync(stoppingToken);

        var grouped = pendingOrders
            .GroupBy(o => o.Symbol)
            .ToDictionary(
                g => g.Key, 
                g => new ConcurrentDictionary<Guid, Order>(g.ToDictionary(o => o.Id, o => o))
            );
        
        foreach (var kvp in grouped)
        {
            _localOrderBook.TryAdd(kvp.Key, kvp.Value);
        }
        
        logger.LogInformation("📦 Loaded {Count} pending orders from database into Lock-Free RAM.", pendingOrders.Count);
    }

    private async Task ListenForNewOrdersAsync(CancellationToken stoppingToken)
    {
        await foreach (var newOrder in ingressQueue.Reader.ReadAllAsync(stoppingToken))
        {
            var symbolBook = _localOrderBook.GetOrAdd(newOrder.Symbol, _ => new ConcurrentDictionary<Guid, Order>());
            
            symbolBook.TryAdd(newOrder.Id, newOrder);
            
            logger.LogDebug("📥 Ingressed new Order {Id} into memory instantly.", newOrder.Id);
        }
    }

    private async Task ProcessMarketTicksAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("📡 Subscribed to internal MarketEventBus. Network gRPC overhead eradicated.");
        
        await foreach (var tick in marketEventBus.Reader.ReadAllAsync(stoppingToken))
        {
            decimal currentPrice = tick.Price;
            string symbol = tick.Symbol;

            if (!_localOrderBook.TryGetValue(symbol, out var pendingOrders) || pendingOrders.IsEmpty)
            {
                continue;
            }

            var matches = pendingOrders.Values.Where(o => 
                o.Type == OrderType.Market ||
                (o.Side == OrderSide.Buy && currentPrice <= o.TargetPrice) ||
                (o.Side == OrderSide.Sell && currentPrice >= o.TargetPrice)
            ).ToList();

            foreach (var match in matches)
            {
                // Lock-free atomic removal
                pendingOrders.TryRemove(match.Id, out _); 
            }

            foreach (var match in matches)
            {
                decimal executionPrice = currentPrice;

                if (match.Type == OrderType.Market)
                {
                    decimal volatilityFactor = Math.Max(tick.Volatility ?? decimal.Zero, decimal.One);
                    decimal slippageBps = (match.Quantity / 100m) * volatilityFactor * 0.0001m;
                    slippageBps = Math.Min(slippageBps, 0.05m);

                    executionPrice = match.Side == OrderSide.Buy 
                        ? currentPrice * (1 + slippageBps) 
                        : currentPrice * (1 - slippageBps);

                    logger.LogInformation("📉 VWAP Execution: Market {Side} of {Qty} {Symbol}. Top-of-book: ${Top}, VWAP Settled: ${Exec}", 
                        match.Side, match.Quantity, match.Symbol, currentPrice, executionPrice);
                }
                else 
                {
                    logger.LogInformation("🎯 Event-Driven Match! Queuing Limit Order {Id} for Settlement at ${Price}.", match.Id, currentPrice);
                }

                settlementQueue.Writer.TryWrite(new TradeSettlementCommand(match.Id, executionPrice));
            }
        }
    }
}