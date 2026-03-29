using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services.Orders;
using TradeEngine.Infrastructure.Services.TradeSettlement;

namespace TradeEngine.Infrastructure.BackgroundServices.OrderMatching;

public class OrderMatchingWorker(
    IServiceScopeFactory scopeFactory,
    SettlementQueue settlementQueue,
    IOrderIngressQueue ingressQueue,
    IMarketEventBus marketEventBus,
    DormantOrderTracker dormantOrderTracker,
    ILogger<OrderMatchingWorker> logger) : BackgroundService
{
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

        foreach (var order in pendingOrders)
        {
            if (order.Type == OrderType.StopLoss || order.Type == OrderType.TakeProfit)
            {
                dormantOrderTracker.Register(order);
            }
            else
            {
                var symbolBook = _localOrderBook.GetOrAdd(order.Symbol, _ => new ConcurrentDictionary<Guid, Order>());
                symbolBook.TryAdd(order.Id, order);
            }
        }
        
        logger.LogInformation("📦 Loaded {Count} pending orders from database into Lock-Free RAM.", pendingOrders.Count);
    }

    private async Task ListenForNewOrdersAsync(CancellationToken stoppingToken)
    {
        await foreach (var newOrder in ingressQueue.Reader.ReadAllAsync(stoppingToken))
        {
            if (newOrder.Type == OrderType.StopLoss || newOrder.Type == OrderType.TakeProfit)
            {
                dormantOrderTracker.Register(newOrder);
                logger.LogDebug("📥 Ingressed Dormant Order {Id} ({Type}) into tracking engine.", newOrder.Id, newOrder.Type);
            }
            else
            {
                var symbolBook = _localOrderBook.GetOrAdd(newOrder.Symbol, _ => new ConcurrentDictionary<Guid, Order>());
                symbolBook.TryAdd(newOrder.Id, newOrder);
                logger.LogDebug("📥 Ingressed Active Order {Id} into memory instantly.", newOrder.Id);
            }
        }
    }

    private async Task ProcessMarketTicksAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("📡 Subscribed to internal MarketEventBus. Network gRPC overhead eradicated.");
        
        await foreach (var tick in marketEventBus.Reader.ReadAllAsync(stoppingToken))
        {
            decimal currentPrice = tick.Price;
            string symbol = tick.Symbol;

            var triggeredOrders = dormantOrderTracker.EvaluateTriggers(symbol, currentPrice);
            
            foreach (var triggered in triggeredOrders)
            {
                decimal volatilityFactor = Math.Max(tick.Volatility ?? decimal.Zero, decimal.One);
                decimal slippageBps = (triggered.Quantity / 100m) * volatilityFactor * 0.0001m;
                slippageBps = Math.Min(slippageBps, 0.05m);

                decimal executionPrice = triggered.Side == OrderSide.Buy 
                    ? currentPrice * (1 + slippageBps) 
                    : currentPrice * (1 - slippageBps);

                logger.LogInformation("🚨 CEP Triggered: {Type} {Id} converted to Market Order. Settled at ${Price}", triggered.Type, triggered.Id, executionPrice);
                settlementQueue.Writer.TryWrite(new TradeSettlementCommand(triggered.Id, executionPrice));
            }

            // 2. Standard Limit Book Evaluation
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

                settlementQueue.Writer.TryWrite(new TradeSettlementCommand(match.Id, executionPrice));
            }
        }
    }
}