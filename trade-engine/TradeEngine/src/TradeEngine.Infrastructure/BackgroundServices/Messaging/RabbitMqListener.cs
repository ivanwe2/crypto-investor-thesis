using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TradeEngine.Application.Constants;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Services;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;
using System.Diagnostics;

namespace TradeEngine.Infrastructure.BackgroundServices.Messaging;

public class RabbitMqListener(
    ILogger<RabbitMqListener> logger,
    IConfiguration configuration,
    IPriceBroadcaster priceBroadcaster,
    IMarketStateCache marketStateCache,
    IMarketEventBus marketEventBus) : BackgroundService // INJECTED EVENT BUS HERE
{
    private IConnection? _connection;
    private IChannel? _channel;
    
    private readonly string _hostName = configuration[RabbitMqConstants.HostConfigKey] ?? RabbitMqConstants.DefaultHost;
    private readonly int _port = int.Parse(configuration[RabbitMqConstants.PortConfigKey] ?? RabbitMqConstants.DefaultPort);
    private readonly string _username = configuration[RabbitMqConstants.UsernameConfigKey] ?? RabbitMqConstants.DefaultUsername;
    private readonly string _password = configuration[RabbitMqConstants.PasswordConfigKey] ?? RabbitMqConstants.DefaultPassword;

    private static readonly ActivitySource ActivitySource = new("TradeEngine");

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        PropertyNameCaseInsensitive = true
    };

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

                await _channel.ExchangeDeclareAsync(
                    exchange: RabbitMqConstants.ExchangeName, 
                    type: ExchangeType.Fanout, 
                    durable: true,
                    cancellationToken: stoppingToken);

                await _channel.QueueDeclareAsync(
                    queue: RabbitMqConstants.QueueName, 
                    durable: true, 
                    exclusive: false, 
                    autoDelete: false,
                    cancellationToken: stoppingToken);

                await _channel.QueueBindAsync(
                    queue: RabbitMqConstants.QueueName, 
                    exchange: RabbitMqConstants.ExchangeName, 
                    routingKey: RabbitMqConstants.RoutingKey,
                    cancellationToken: stoppingToken);

                logger.LogInformation(".NET Listener connected to RabbitMQ at {Host}:{Port}", _hostName, _port);

                var consumer = new AsyncEventingBasicConsumer(_channel);
                
                consumer.ReceivedAsync += async (model, ea) =>
                {
                    var parentContext = Propagators.DefaultTextMapPropagator.Extract(default, ea.BasicProperties.Headers, (headers, key) =>
                    {
                        if (headers != null && headers.TryGetValue(key, out var value))
                        {
                            if (value is byte[] bytes)
                            {
                                return [Encoding.UTF8.GetString(bytes)];
                            }
                            return [value?.ToString() ?? string.Empty];
                        }
                        return [];
                    });

                    using var activity = ActivitySource.StartActivity("Process RabbitMQ Trade", ActivityKind.Consumer, parentContext.ActivityContext);
                    
                    activity?.SetTag("messaging.system", "rabbitmq");
                    activity?.SetTag("messaging.operation", "receive");

                    var body = ea.Body.ToArray();
                    var message = Encoding.UTF8.GetString(body);
                    
                    await ProcessMessageAsync(message);
                };

                await _channel.BasicConsumeAsync(
                    queue: RabbitMqConstants.QueueName,
                    autoAck: true,
                    consumer: consumer,
                    cancellationToken: stoppingToken);

                // Wait here until the connection drops or shutdown is requested
                var connectionClosed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _connection.ConnectionShutdownAsync += (_, _) => { connectionClosed.TrySetResult(); return Task.CompletedTask; };
                await Task.WhenAny(connectionClosed.Task, Task.Delay(Timeout.Infinite, stoppingToken));

                if (stoppingToken.IsCancellationRequested) return;

                logger.LogWarning("RabbitMQ Listener lost connection. Reconnecting...");
            }
            catch (Exception ex)
            {
                logger.LogWarning("RabbitMQ not reachable yet. Retrying in 3s... Error: {Message}", ex.Message);
                try
                {
                    await Task.Delay(3000, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
            finally
            {
                if (_channel is not null) { _channel.Dispose(); _channel = null; }
                if (_connection is not null) { _connection.Dispose(); _connection = null; }
            }
        }
    }

    private async Task ProcessMessageAsync(string message)
    {
        try
        {
            var trade = JsonSerializer.Deserialize<TradeUpdate>(message, _jsonOptions);

            if (trade is not null && trade.Data.Price > 0)
            {
                // Write directly to our fast internal pipeline (Challenge 13 Solved)
                marketEventBus.Writer.TryWrite(trade.Data);

                await priceBroadcaster.BroadcastPriceAsync(trade.Data);
                marketStateCache.UpdatePrice(trade.Data.Symbol, trade.Data.Price);
            }
            else
            {
                logger.LogWarning("Received message but Price was 0. Raw JSON: {Raw}", message);
            }
        }
        catch (Exception ex)
        {
            logger.LogError("Error parsing message: {Message}", ex.Message);
        }
    }

    public override void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}