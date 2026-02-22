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

namespace TradeEngine.Infrastructure.Messaging;

public class RabbitMqListener(
    ILogger<RabbitMqListener> logger,
    IConfiguration configuration,
    IPriceBroadcaster priceBroadcaster,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    private IConnection? _connection;
    private IChannel? _channel;
    
    private readonly string _hostName = configuration[RabbitMqConstants.HostConfigKey] ?? RabbitMqConstants.DefaultHost;
    private readonly int _port = int.Parse(configuration[RabbitMqConstants.PortConfigKey] ?? RabbitMqConstants.DefaultPort);
    private readonly string _username = configuration[RabbitMqConstants.UsernameConfigKey] ?? RabbitMqConstants.DefaultUsername;
    private readonly string _password = configuration[RabbitMqConstants.PasswordConfigKey] ?? RabbitMqConstants.DefaultPassword;

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        PropertyNameCaseInsensitive = true
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // RETRY LOOP: Keep trying to connect until successful or cancelled
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
                
                // Attempt connection
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
                    var body = ea.Body.ToArray();
                    var message = Encoding.UTF8.GetString(body);
                    await ProcessMessageAsync(message);
                };

                await _channel.BasicConsumeAsync(
                    queue: RabbitMqConstants.QueueName, 
                    autoAck: true, 
                    consumer: consumer,
                    cancellationToken: stoppingToken);

                break;
            }
            catch (Exception ex)
            {
                // Log warning and wait before retrying
                logger.LogWarning("RabbitMQ not reachable yet. Retrying in 3s... Error: {Message}", ex.Message);
                try 
                {
                    await Task.Delay(3000, stoppingToken);
                } 
                catch (OperationCanceledException) 
                {
                    // Graceful shutdown
                    return;
                }
            }
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(1000, stoppingToken);
        }
    }

    private async Task ProcessMessageAsync(string message)
    {
        try
        {
            var trade = JsonSerializer.Deserialize<TradeUpdate>(message, _jsonOptions);

            if (trade is not null && trade.Data.Price > 0)
            {
                logger.LogDebug("{Symbol} @ ${Price}", trade.Data.Symbol, trade.Data.Price);

                await priceBroadcaster.BroadcastPriceAsync(trade.Data);

                using var scope = serviceScopeFactory.CreateScope();
                var matchingEngine = scope.ServiceProvider.GetRequiredService<IMatchingEngine>();
                await matchingEngine.ProcessTickAsync(trade.Data);
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