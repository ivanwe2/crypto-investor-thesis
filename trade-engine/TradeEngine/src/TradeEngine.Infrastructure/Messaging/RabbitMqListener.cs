using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TradeEngine.Application.Constants;
using TradeEngine.Application.DTOs;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.Messaging;

public class RabbitMqListener(
    ILogger<RabbitMqListener> logger,
    IConfiguration configuration,
    IPriceBroadcaster priceBroadcaster) : BackgroundService
{
    private IConnection? _connection;
    private IChannel? _channel;
    
    private readonly string _hostName = configuration[MessagingConstants.RabbitMqHostConfigKey] ?? MessagingConstants.DefaultHost;
    private readonly int _port = int.Parse(configuration[MessagingConstants.RabbitMqPortConfigKey] ?? MessagingConstants.DefaultPort);
    private readonly string _username = configuration["RabbitMq:Username"] ?? "guest";
    private readonly string _password = configuration["RabbitMq:Password"] ?? "guest";

    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        PropertyNameCaseInsensitive = true
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            var factory = new ConnectionFactory 
            { 
                HostName = _hostName, 
                Port = _port,
                UserName = _username,
                Password = _password,
            };
            
            // 1. Async Connection & Channel Creation
            _connection = await factory.CreateConnectionAsync(stoppingToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);

            // 2. Async Topology Declaration
            await _channel.ExchangeDeclareAsync(
                exchange: MessagingConstants.ExchangeName, 
                type: ExchangeType.Fanout, 
                durable: true,
                cancellationToken: stoppingToken);

            await _channel.QueueDeclareAsync(
                queue: MessagingConstants.QueueName, 
                durable: true, 
                exclusive: false, 
                autoDelete: false,
                cancellationToken: stoppingToken);

            await _channel.QueueBindAsync(
                queue: MessagingConstants.QueueName, 
                exchange: MessagingConstants.ExchangeName, 
                routingKey: MessagingConstants.RoutingKey,
                cancellationToken: stoppingToken);

            logger.LogInformation(".NET Listener connected to RabbitMQ at {Host}:{Port}", _hostName, _port);

            // 3. Async Consumer
            // We use AsyncEventingBasicConsumer instead of EventingBasicConsumer
            var consumer = new AsyncEventingBasicConsumer(_channel);
            
            consumer.ReceivedAsync += async (model, ea) =>
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);
                
                await ProcessMessageAsync(message);
            };

            await _channel.BasicConsumeAsync(
                queue: MessagingConstants.QueueName, 
                autoAck: true, 
                consumer: consumer,
                cancellationToken: stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }
        }
        catch (Exception ex)
        {
            logger.LogError("Could not connect to RabbitMQ: {Message}", ex.Message);
        }
    }

    private async Task ProcessMessageAsync(string message)
    {
        try
        {
            var trade = JsonSerializer.Deserialize<TradeUpdate>(message, _jsonOptions);

            if (trade is not null && trade.Data.Price > 0)
            {
                logger.LogInformation("{Symbol} @ ${Price}", trade.Data.Symbol, trade.Data.Price);

                await priceBroadcaster.BroadcastPriceAsync(trade.Data);
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