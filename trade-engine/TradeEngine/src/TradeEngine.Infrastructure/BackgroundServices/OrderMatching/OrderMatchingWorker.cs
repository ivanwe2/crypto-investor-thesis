using System.Collections.Concurrent;
using Grpc.Core;
using Marketgateway.V1;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services;
using TradeEngine.Infrastructure.Services.Orders;
using TradeEngine.Infrastructure.Services.TradeSettlement;

namespace TradeEngine.Infrastructure.BackgroundServices.OrderMatching;

public class OrderMatchingWorker(
    IServiceScopeFactory scopeFactory,
    SettlementQueue settlementQueue,
    OrderIngressQueue ingressQueue,
    ILogger<OrderMatchingWorker> logger) : BackgroundService
{
    // Our local RAM book
    private readonly ConcurrentDictionary<string, List<Order>> _localOrderBook = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("🚀 Ultimate HFT Event-Driven Order Matcher started.");

        // 1. Load pending orders from the database ONLY ONCE on startup
        await LoadInitialOrdersAsync(stoppingToken);

        // 2. Run the two event-driven loops concurrently
        var ingressTask = ListenForNewOrdersAsync(stoppingToken);
        var matchTask = StreamAndMatchAsync(stoppingToken);

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

        var grouped = pendingOrders.GroupBy(o => o.Symbol)
                                   .ToDictionary(g => g.Key, g => g.ToList());
        
        foreach (var kvp in grouped)
        {
            _localOrderBook.TryAdd(kvp.Key, kvp.Value);
        }
        
        logger.LogInformation("📦 Loaded {Count} pending orders from database into RAM.", pendingOrders.Count);
    }

    private async Task ListenForNewOrdersAsync(CancellationToken stoppingToken)
    {
        // ✨ LEVEL 3 FIX: Instantly add new orders to the RAM book as they arrive from the API
        await foreach (var newOrder in ingressQueue.Reader.ReadAllAsync(stoppingToken))
        {
            _localOrderBook.AddOrUpdate(
                newOrder.Symbol,
                [newOrder], // If symbol doesn't exist, create new list
                (key, existingList) => 
                {
                    // Using a lock here ensures thread safety for the specific list being modified
                    lock (existingList) 
                    {
                        existingList.Add(newOrder);
                    }
                    return existingList;
                }
            );
            
            logger.LogDebug("📥 Ingressed new Order {Id} into memory instantly.", newOrder.Id);
        }
    }

    private async Task StreamAndMatchAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var grpcClient = scope.ServiceProvider.GetRequiredService<MarketDataService.MarketDataServiceClient>();

                var request = new StreamRequest(); 
                request.Symbols.AddRange(new[] { "BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT" });

                logger.LogInformation("📡 Opening continuous gRPC stream to Market Gateway...");
                using var call = grpcClient.StreamMarketData(request, cancellationToken: stoppingToken);

                await foreach (var snapshot in call.ResponseStream.ReadAllAsync(stoppingToken))
                {
                    decimal currentPrice = (decimal)snapshot.Price;
                    string symbol = snapshot.Symbol;

                    if (!_localOrderBook.TryGetValue(symbol, out var pendingOrders) || pendingOrders.Count == 0)
                    {
                        continue;
                    }

                    List<Order> matches;
                    // Lock the list briefly to safely find and remove matching orders
                    lock (pendingOrders)
                    {
                        matches = pendingOrders.Where(o => 
                            (o.Side == OrderSide.Buy && currentPrice <= o.TargetPrice) ||
                            (o.Side == OrderSide.Sell && currentPrice >= o.TargetPrice)
                        ).ToList();

                        foreach (var match in matches)
                        {
                            pendingOrders.Remove(match); // Prevent double-matching
                        }
                    }

                    foreach (var match in matches)
                    {
                        if (snapshot.Volatility > 10.0) {
                            logger.LogInformation("📊 Note: Executing {Symbol} trade during high volatility (Welford: {Vol})", symbol, snapshot.Volatility);
                        }

                        logger.LogInformation("🎯 Event-Driven Match! Queuing Order {Id} for Settlement at ${Price}.", match.Id, currentPrice);
                        
                        settlementQueue.Writer.TryWrite(new TradeSettlementCommand(match.Id, currentPrice));
                    }
                }
            }
            catch (RpcException ex) when (ex.StatusCode == StatusCode.Cancelled)
            {
                logger.LogInformation("gRPC Stream cancelled.");
            }
            catch (Exception ex)
            {
                logger.LogWarning("gRPC Stream disconnected. Retrying in 3 seconds... Error: {Message}", ex.Message);
                await Task.Delay(3000, stoppingToken);
            }
        }
    }
}