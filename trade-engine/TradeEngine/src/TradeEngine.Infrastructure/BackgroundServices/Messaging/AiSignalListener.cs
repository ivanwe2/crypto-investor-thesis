using System.Diagnostics;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TradeEngine.Application.Constants;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.BackgroundServices.Messaging;

public class AiSignalListener(
    ILogger<AiSignalListener> logger,
    IServiceProvider serviceProvider,
    IConfiguration configuration) : BackgroundService
{
    private IConnection? _connection;
    private IChannel? _channel;
    
    private readonly string _hostName = configuration[RabbitMqConstants.HostConfigKey] ?? RabbitMqConstants.DefaultHost;
    private readonly int _port = int.Parse(configuration[RabbitMqConstants.PortConfigKey] ?? RabbitMqConstants.DefaultPort);
    private readonly string _username = configuration[RabbitMqConstants.UsernameConfigKey] ?? RabbitMqConstants.DefaultUsername;
    private readonly string _password = configuration[RabbitMqConstants.PasswordConfigKey] ?? RabbitMqConstants.DefaultPassword;

    private static readonly ActivitySource ActivitySource = new("TradeEngine");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var factory = new ConnectionFactory 
                { 
                    HostName = _hostName, 
                    Port = _port,
                    UserName = _username,
                    Password = _password
                };
                
                _connection = await factory.CreateConnectionAsync(stoppingToken);
                _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);

                // 1. Ensure the exchange exists
                await _channel.ExchangeDeclareAsync("ai_signals", ExchangeType.Fanout, durable: true, cancellationToken: stoppingToken);

                // 2. Create a unique queue for the Trade Engine to listen to AI signals
                var queueDeclareResult = await _channel.QueueDeclareAsync(
                    queue: "trade_engine_ai_queue", durable: true, exclusive: false, autoDelete: false, cancellationToken: stoppingToken);

                await _channel.QueueBindAsync(queueDeclareResult.QueueName, "ai_signals", string.Empty, cancellationToken: stoppingToken);

                logger.LogInformation("🤖 AI Signal Listener connected to RabbitMQ. Waiting for FinBERT predictions...");

                var consumer = new AsyncEventingBasicConsumer(_channel);
                consumer.ReceivedAsync += async (model, ea) =>
                {
                    // ✨ Extract W3C Trace Context from Python!
                    var parentContext = Propagators.DefaultTextMapPropagator.Extract(default, ea.BasicProperties.Headers, (headers, key) =>
                    {
                        if (headers != null && headers.TryGetValue(key, out var value))
                        {
                            if (value is byte[] bytes) return new[] { Encoding.UTF8.GetString(bytes) };
                            return new[] { value?.ToString() ?? string.Empty };
                        }
                        return Enumerable.Empty<string>();
                    });

                    using var activity = ActivitySource.StartActivity("Receive AI Signal", ActivityKind.Consumer, parentContext.ActivityContext);
                    
                    var body = ea.Body.ToArray();
                    var message = Encoding.UTF8.GetString(body);

                    try
                    {
                        var signal = JsonSerializer.Deserialize<AiSignalUpdate>(message, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (signal != null)
                        {
                            logger.LogInformation("🔮 Received AI Prediction: {Symbol} is {Signal} ({Confidence:P0})", 
                                signal.Symbol, signal.Signal, signal.Confidence);

                            // Send to React Frontend via SignalR!
                            using var scope = serviceProvider.CreateScope();
                            var notifier = scope.ServiceProvider.GetRequiredService<ITradeNotifier>();
                            
                            await notifier.NotifyAiSignalAsync(signal.Symbol, signal.Signal, signal.Confidence, signal.Reason, signal.Side ?? "", signal.Timestamp ?? "");
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Failed to parse AI Signal JSON.");
                    }
                };

                await _channel.BasicConsumeAsync("trade_engine_ai_queue", autoAck: true, consumer: consumer, cancellationToken: stoppingToken);

                // Wait here until the connection drops or shutdown is requested
                var connectionClosed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _connection.ConnectionShutdownAsync += (_, _) => { connectionClosed.TrySetResult(); return Task.CompletedTask; };
                await Task.WhenAny(connectionClosed.Task, Task.Delay(Timeout.Infinite, stoppingToken));

                if (stoppingToken.IsCancellationRequested) return;

                logger.LogWarning("AI Signal Listener lost RabbitMQ connection. Reconnecting...");
            }
            catch (Exception ex)
            {
                logger.LogWarning("AI Listener RabbitMQ retry in 5s... {Message}", ex.Message);
                try { await Task.Delay(5000, stoppingToken); } catch (OperationCanceledException) { return; }
            }
            finally
            {
                if (_channel is not null) { await _channel.DisposeAsync(); _channel = null; }
                if (_connection is not null) { await _connection.DisposeAsync(); _connection = null; }
            }
        }
    }

    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}