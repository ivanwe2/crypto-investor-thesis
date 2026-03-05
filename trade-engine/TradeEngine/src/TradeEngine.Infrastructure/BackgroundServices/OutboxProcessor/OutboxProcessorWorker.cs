using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace TradeEngine.Infrastructure.BackgroundServices.OutboxProcessor;

public class OutboxProcessorWorker(
    IServiceProvider serviceProvider,
    ILogger<OutboxProcessorWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Outbox Processor Worker starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                
                var dbContext = scope.ServiceProvider.GetRequiredService<Persistence.TradeEngineDbContext>();
                
                var messages = await dbContext.TradeOutboxMessages
                    .Where(m => m.ProcessedOnUtc == null)
                    .OrderBy(m => m.OccurredOnUtc)
                    .Take(20)
                    .ToListAsync(stoppingToken);

                if (messages.Count > 0)
                {
                    logger.LogInformation("Found {Count} outbox messages to process", messages.Count);

                    foreach (var message in messages)
                    {
                        try
                        {
                            message.ProcessedOnUtc = DateTime.UtcNow;
                            logger.LogDebug("Published outbox message {Id}", message.Id);
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Failed to publish message {Id}", message.Id);
                            message.Error = ex.Message;
                        }
                    }

                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "An error occurred while processing outbox messages.");
            }

            await Task.Delay(5000, stoppingToken);
        }
    }
}