using System.Diagnostics;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using OpenTelemetry;
using OpenTelemetry.Context.Propagation;
using RabbitMQ.Client;
using TradeEngine.Application.Constants;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.Services.Messaging;

public class RabbitMqPublisher : IMessagePublisher, IAsyncDisposable
{
    private readonly ILogger<RabbitMqPublisher> _logger;
    private readonly ConnectionFactory _factory;
    private IConnection? _connection;
    private IChannel? _channel;
    
    private static readonly ActivitySource ActivitySource = new("TradeEngine");

    public RabbitMqPublisher(IConfiguration configuration, ILogger<RabbitMqPublisher> logger)
    {
        _logger = logger;
        _factory = new ConnectionFactory
        {
            HostName = configuration[RabbitMqConstants.HostConfigKey] ?? RabbitMqConstants.DefaultHost,
            Port = int.Parse(configuration[RabbitMqConstants.PortConfigKey] ?? RabbitMqConstants.DefaultPort),
            UserName = configuration[RabbitMqConstants.UsernameConfigKey] ?? RabbitMqConstants.DefaultUsername,
            Password = configuration[RabbitMqConstants.PasswordConfigKey] ?? RabbitMqConstants.DefaultPassword
        };
    }

    private async Task EnsureConnectionAsync(CancellationToken cancellationToken)
    {
        if (_connection == null || _channel == null)
        {
            _connection = await _factory.CreateConnectionAsync(cancellationToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: cancellationToken);

            await _channel.ExchangeDeclareAsync(
                exchange: "trade_events",
                type: ExchangeType.Fanout,
                durable: true,
                cancellationToken: cancellationToken);
        }
    }

    public async Task PublishAsync(string eventType, string payload, CancellationToken cancellationToken = default)
    {
        await EnsureConnectionAsync(cancellationToken);

        // 1. Create a tracing span for the publish action
        using var activity = ActivitySource.StartActivity($"Publish {eventType}", ActivityKind.Producer);
        activity?.SetTag("messaging.system", "rabbitmq");
        activity?.SetTag("messaging.destination", "trade_events");

        // 2. Setup RabbitMQ properties and headers
        var properties = new BasicProperties
        {
            Persistent = true,
            Type = eventType,
            ContentType = "application/json",
            Headers = new Dictionary<string, object?>()
        };

        // 3. Inject the W3C Trace Context into the RabbitMQ headers
        // This is exactly what we did in Go, but in reverse!
        var activityContext = activity?.Context ?? Activity.Current?.Context ?? default;
        Propagators.DefaultTextMapPropagator.Inject(
            new PropagationContext(activityContext, Baggage.Current),
            properties.Headers,
            (headers, key, value) => headers[key] = value);

        // 4. Publish the message
        var body = Encoding.UTF8.GetBytes(payload);
        
        await _channel!.BasicPublishAsync(
            exchange: "trade_events",
            routingKey: string.Empty, // Fanout ignores routing keys
            mandatory: false,
            basicProperties: properties,
            body: body,
            cancellationToken: cancellationToken);

        _logger.LogDebug("Published {EventType} to RabbitMQ. TraceId: {TraceId}", eventType, activityContext.TraceId);
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null) await _channel.DisposeAsync();
        if (_connection is not null) await _connection.DisposeAsync();
    }
}