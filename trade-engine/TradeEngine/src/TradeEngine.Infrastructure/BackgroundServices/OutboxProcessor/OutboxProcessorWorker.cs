using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Persistence;

namespace TradeEngine.Infrastructure.BackgroundServices.OutboxProcessor;

public class OutboxProcessorWorker(
    IServiceProvider serviceProvider,
    ILogger<OutboxProcessorWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("🚀 Outbox Processor & Redis Projector Worker starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                
                var dbContext = scope.ServiceProvider.GetRequiredService<TradeEngineDbContext>();
                var publisher = scope.ServiceProvider.GetRequiredService<IMessagePublisher>();
                
                var messages = await dbContext.TradeOutboxMessages
                    .Where(m => m.ProcessedOnUtc == null)
                    .OrderBy(m => m.OccurredOnUtc)
                    .Take(20)
                    .ToListAsync(stoppingToken);

                if (messages.Count > 0)
                {
                    logger.LogInformation("📦 Found {Count} outbox messages to process", messages.Count);

                    foreach (var message in messages)
                    {
                        try
                        {
                            // 1. Publish to RabbitMQ (For AI Analyst & Eventual Microservices)
                            await publisher.PublishAsync(message.Type, message.Content, stoppingToken);
                            
                            // 2. ✨ CQRS REDIS PROJECTION ✨
                            if (message.Type == "TradeSettled")
                            {
                                await ProjectTradeSettledToRedisAsync(scope.ServiceProvider, message.Content, stoppingToken);
                            }
                            
                            message.ProcessedOnUtc = DateTime.UtcNow;
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "❌ Failed to process message {Id}", message.Id);
                            message.Error = ex.Message;
                        }
                    }

                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "❌ An error occurred while processing outbox messages.");
            }

            await Task.Delay(3000, stoppingToken);
        }
    }

    private async Task ProjectTradeSettledToRedisAsync(IServiceProvider sp, string jsonContent, CancellationToken ct)
    {
        try
        {
            using var document = JsonDocument.Parse(jsonContent);
            
            // Extract UserId AND OrderId from the JSON event payload
            if (!document.RootElement.TryGetProperty("UserId", out var userIdElement) || !Guid.TryParse(userIdElement.GetString(), out var userId)) return;
            if (!document.RootElement.TryGetProperty("OrderId", out var orderIdElement) || !Guid.TryParse(orderIdElement.GetString(), out var orderId)) return;

            var redisService = sp.GetRequiredService<IRedisReadModelService>();
            var dbContext = sp.GetRequiredService<TradeEngineDbContext>();

            // 1. ✨ CLEANUP: Remove the filled order from the Open Orders Redis Cache
            await redisService.RemoveOpenOrderAsync(userId, orderId, ct);
            logger.LogInformation("⚡ Redis Read Model: Order {OrderId} removed from active orders.", orderId);

            // 2. UPDATE WALLET: Fetch the freshly settled wallet from Postgres
            var wallet = await dbContext.Wallets
                .Include(w => w.Balances)
                .AsNoTracking()
                .SingleOrDefaultAsync(w => w.UserId == userId, ct);

            if (wallet != null)
            {
                var balances = wallet.Balances.Select(b => new AssetBalanceDto(b.Currency, b.Amount)).ToList();
                var response = new WalletResponse(wallet.Id, balances);
                
                await redisService.UpdateUserPortfolioAsync(userId, response, ct);
                logger.LogInformation("⚡ Redis Read Model updated instantly for User {UserId} (Wallet)", userId);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "⚠️ Failed to project TradeSettled event to Redis.");
        }
    }
}