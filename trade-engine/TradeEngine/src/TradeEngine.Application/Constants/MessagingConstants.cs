namespace TradeEngine.Application.Constants;

public static class MessagingConstants
{
    // RabbitMQ Topology
    public const string ExchangeName = "crypto_prices";
    public const string QueueName = "trade_engine_queue";
    public const string RoutingKey = "";
    
    // Configuration Keys
    public const string RabbitMqHostConfigKey = "RabbitMq:Host";
    public const string RabbitMqPortConfigKey = "RabbitMq:Port";
    
    // Defaults
    public const string DefaultHost = "localhost";
    public const string DefaultPort = "5672";
}