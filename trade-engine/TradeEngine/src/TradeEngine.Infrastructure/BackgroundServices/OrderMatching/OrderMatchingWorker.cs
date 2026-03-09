using System.Collections.Concurrent;
using Grpc.Core;
using Marketgateway.V1;
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
    ILogger<OrderMatchingWorker> logger) : BackgroundService
{
    // ✨ BOOST: Changed inner collection to Dictionary<Guid, Order> for O(1) removals instead of O(N) List shifting
    private readonly ConcurrentDictionary<string, Dictionary<Guid, Order>> _localOrderBook = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("🚀 Ultimate HFT Event-Driven Order Matcher started (O(1) Optimized).");

        await LoadInitialOrdersAsync(stoppingToken);

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

        // Map to nested dictionaries
        var grouped = pendingOrders
            .GroupBy(o => o.Symbol)
            .ToDictionary(g => g.Key, g => g.ToDictionary(o => o.Id, o => o));
        
        foreach (var kvp in grouped)
        {
            _localOrderBook.TryAdd(kvp.Key, kvp.Value);
        }
        
        logger.LogInformation("📦 Loaded {Count} pending orders from database into RAM.", pendingOrders.Count);
    }

    private async Task ListenForNewOrdersAsync(CancellationToken stoppingToken)
    {
        await foreach (var newOrder in ingressQueue.Reader.ReadAllAsync(stoppingToken))
        {
            _localOrderBook.AddOrUpdate(
                newOrder.Symbol,
                new Dictionary<Guid, Order> { [newOrder.Id] = newOrder }, 
                (key, existingDict) => 
                {
                    lock (existingDict) 
                    {
                        existingDict[newOrder.Id] = newOrder; // O(1) Add
                    }
                    return existingDict;
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
                request.Symbols.AddRange(["BTCUSDT", "ETHUSDT", "SOLUSDT", "ADAUSDT"]);

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
                    
                    lock (pendingOrders)
                    {
                        // Use .Values to iterate
                        matches = pendingOrders.Values.Where(o => 
                            (o.Side == OrderSide.Buy && currentPrice <= o.TargetPrice) ||
                            (o.Side == OrderSide.Sell && currentPrice >= o.TargetPrice)
                        ).ToList();

                        foreach (var match in matches)
                        {
                            pendingOrders.Remove(match.Id); // ✨ O(1) REMOVAL! Massive performance gain.
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