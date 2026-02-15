using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using TradeEngine.Application.Constants;
using TradeEngine.Application.DTOs;

namespace TradeEngine.Infrastructure.Messaging;

public class RabbitMqListener(
    ILogger<RabbitMqListener> logger,
    IConfiguration configuration) : BackgroundService
{
    private IConnection? _connection;
    private IModel? _channel;
    
    private readonly string _hostName = configuration[MessagingConstants.RabbitMqHostConfigKey] ?? MessagingConstants.DefaultHost;
    private readonly int _port = int.Parse(configuration[MessagingConstants.RabbitMqPortConfigKey] ?? MessagingConstants.DefaultPort);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            var factory = new ConnectionFactory 
            { 
                HostName = _hostName, 
                Port = _port 
            };
            
            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            _channel.ExchangeDeclare(
                exchange: MessagingConstants.ExchangeName, 
                type: ExchangeType.Fanout, 
                durable: true);

            _channel.QueueDeclare(
                queue: MessagingConstants.QueueName, 
                durable: true, 
                exclusive: false, 
                autoDelete: false);

            _channel.QueueBind(
                queue: MessagingConstants.QueueName, 
                exchange: MessagingConstants.ExchangeName, 
                routingKey: MessagingConstants.RoutingKey);

            logger.LogInformation("NET Listener connected to RabbitMQ at {Host}:{Port}", _hostName, _port);

            var consumer = new EventingBasicConsumer(_channel);
            consumer.Received += (model, ea) =>
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);
                ProcessMessage(message);
            };

            _channel.BasicConsume(queue: MessagingConstants.QueueName, autoAck: true, consumer: consumer);
        }
        catch (Exception ex)
        {
            logger.LogError("Could not connect to RabbitMQ: {Message}", ex.Message);
        }

        return Task.CompletedTask;
    }

    private void ProcessMessage(string message)
    {
        try
        {
            var trade = JsonSerializer.Deserialize<TradeUpdate>(message);

            if (trade is not null && trade.Data.Price > 0)
            {
                logger.LogInformation("Received: {Symbol} @ ${Price}", trade.Data.Symbol, trade.Data.Price);
            }
        }
        catch (Exception ex)
        {
            logger.LogError("Error parsing message: {Message}", ex.Message);
        }
    }

    public override void Dispose()
    {
        _channel?.Close();
        _connection?.Close();
        base.Dispose();
    }
}