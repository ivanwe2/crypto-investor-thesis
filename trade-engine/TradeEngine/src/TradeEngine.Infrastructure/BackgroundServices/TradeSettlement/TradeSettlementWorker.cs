using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services.Outbox;
using TradeEngine.Infrastructure.Services.TradeSettlement;

namespace TradeEngine.Infrastructure.BackgroundServices.TradeSettlement;

public class TradeSettlementWorker(
    IServiceScopeFactory scopeFactory,
    SettlementQueue settlementQueue,
    OutboxTrigger outboxTrigger,
    ILogger<TradeSettlementWorker> logger) : BackgroundService
{
     protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("🏦 Trade Settlement Engine started with Atomic Database Execution.");

        await foreach (var command in settlementQueue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<TradeEngineDbContext>();
                var tradeNotifier = scope.ServiceProvider.GetRequiredService<ITradeNotifier>();
                
                var redisService = scope.ServiceProvider.GetRequiredService<IRedisReadModelService>();

                var strategy = db.Database.CreateExecutionStrategy();

                await strategy.ExecuteAsync(async () => 
                {
                    var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.Id == command.OrderId, stoppingToken);
                    
                    if (order == null || order.Status != OrderStatus.Pending) return; 

                    using var transaction = await db.Database.BeginTransactionAsync(stoppingToken);

                    var updatedCount = await db.Orders
                        .Where(o => o.Id == order.Id && o.Status == OrderStatus.Pending)
                        .ExecuteUpdateAsync(s => s
                            .SetProperty(x => x.Status, OrderStatus.Filled)
                            .SetProperty(x => x.ExecutionPrice, command.ExecutionPrice)
                            .SetProperty(x => x.ExecutedAt, DateTime.UtcNow), 
                            stoppingToken);

                    if (updatedCount == 0) return; 

                    var wallet = await db.Wallets
                        .Include(w => w.Balances)
                        .AsNoTracking()
                        .SingleOrDefaultAsync(w => w.UserId == order.UserId, stoppingToken);

                    if (wallet == null) return;

                    string quoteCurrency = order.Symbol.EndsWith("USDT") ? "USDT" : "USD";
                    string baseCurrency = order.Symbol.Replace(quoteCurrency, "");

                    decimal quoteAmountChange = order.Side == OrderSide.Buy 
                        ? (order.Quantity * order.TargetPrice) - (order.Quantity * command.ExecutionPrice) 
                        : order.Quantity * command.ExecutionPrice;
                        
                    decimal baseAmountChange = order.Side == OrderSide.Buy ? order.Quantity : 0;

                    async Task UpsertBalanceAsync(string currency, decimal amount)
                    {
                        if (amount <= 0) return;

                        var existing = wallet.Balances.FirstOrDefault(b => b.Currency == currency);
                        if (existing != null)
                        {
                            await db.Set<AssetBalance>()
                                .Where(b => b.Id == existing.Id)
                                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Amount, x => x.Amount + amount), stoppingToken);
                        }
                        else
                        {
                            var newBalance = new AssetBalance(wallet.Id, currency);
                            newBalance.Add(amount);
                            db.Set<AssetBalance>().Add(newBalance);
                            await db.SaveChangesAsync(stoppingToken); 
                        }
                    }

                    await UpsertBalanceAsync(quoteCurrency, quoteAmountChange);
                    await UpsertBalanceAsync(baseCurrency, baseAmountChange);

                    var tradeSettledEvent = new
                    {
                        OrderId = order.Id,
                        UserId = order.UserId,
                        Symbol = order.Symbol,
                        Side = order.Side.ToString(),
                        Quantity = order.Quantity,
                        Price = command.ExecutionPrice,
                        Timestamp = DateTime.UtcNow
                    };

                    var outboxMessage = new TradeOutboxMessage
                    {
                        Id = Guid.NewGuid(),
                        Type = "TradeSettled",
                        Content = JsonSerializer.Serialize(tradeSettledEvent),
                        OccurredOnUtc = DateTime.UtcNow
                    };

                    db.Set<TradeOutboxMessage>().Add(outboxMessage);
                    await db.SaveChangesAsync(stoppingToken);

                    await transaction.CommitAsync(stoppingToken);

                    logger.LogInformation("✅ Settlement Complete: Order {Id} Filled at ${Price}", order.Id, command.ExecutionPrice);

                    outboxTrigger.Trigger();
                    
                    try 
                    {
                        await redisService.RemoveOpenOrderAsync(order.UserId, order.Id, stoppingToken);
                        
                        var balances = wallet.Balances.Select(b => new AssetBalanceDto(b.Currency, b.Amount)).ToList();
                        var walletResponse = new WalletResponse(wallet.Id, balances);
                        await redisService.UpdateUserPortfolioAsync(order.UserId, walletResponse, stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "⚠️ Synchronous Redis update failed. UI may experience a slight delay.");
                    }

                    _ = tradeNotifier.NotifyOrderFilledAsync(order.UserId, order.Symbol, order.Quantity, command.ExecutionPrice);
                });
            }
            catch (Exception ex)
            {
                logger.LogError("❌ Critical Settlement Error for Order {Id}: {Message}", command.OrderId, ex.Message);
            }
        }
    }
}