using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services.Outbox;
using TradeEngine.Infrastructure.Telemetry;

namespace TradeEngine.Infrastructure.BackgroundServices.OutboxProcessor;

public class OutboxProcessorWorker(
    IServiceProvider serviceProvider,
    IMessagePublisher messagePublisher,
    OutboxTrigger outboxTrigger,
    TradingMetrics tradingMetrics,
    ILogger<OutboxProcessorWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Event-Driven Outbox Processor started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessOutboxMessagesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing outbox messages.");
            }

            try
            {
                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                var triggerTask = outboxTrigger.WaitForTriggerAsync(timeoutCts.Token);
                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(30), timeoutCts.Token);

                await Task.WhenAny(triggerTask, timeoutTask);
                
                // Cancel whichever task didn't finish to free up resources
                timeoutCts.Cancel(); 
            }
            catch (OperationCanceledException)
            {
                // Expected during shutdown
            }
        }
    }

    private const int MaxRetryCount = 5;

    private async Task ProcessOutboxMessagesAsync(CancellationToken stoppingToken)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ITradeEngineDbContext>();

        // Skip messages that have exceeded the retry limit
        var messages = await dbContext.TradeOutboxMessages
            .Where(m => !m.ProcessedOnUtc.HasValue && m.RetryCount < MaxRetryCount)
            .OrderBy(m => m.OccurredOnUtc)
            .Take(50)
            .ToListAsync(stoppingToken);

        if (messages.Count == 0) return;

        foreach (var message in messages)
        {
            try
            {
                await messagePublisher.PublishAsync(message.Type, message.Content, stoppingToken);
                message.ProcessedOnUtc = DateTime.UtcNow;
                message.Error = null;
                tradingMetrics.RecordOutboxPublished();
                logger.LogDebug("Processed outbox message {MessageId}", message.Id);
            }
            catch (Exception ex)
            {
                message.RetryCount++;
                message.FailedAt = DateTime.UtcNow;
                message.Error = ex.Message;

                if (message.RetryCount >= MaxRetryCount)
                {
                    tradingMetrics.RecordOutboxDeadLetter();
                    logger.LogError(ex, "Outbox message {MessageId} exceeded max retries ({Max}). Moving to dead-letter state.", message.Id, MaxRetryCount);
                }
                else
                {
                    logger.LogWarning(ex, "Outbox message {MessageId} failed (attempt {Attempt}/{Max}).", message.Id, message.RetryCount, MaxRetryCount);
                }
            }
        }

        await dbContext.SaveChangesAsync(stoppingToken);
    }
}