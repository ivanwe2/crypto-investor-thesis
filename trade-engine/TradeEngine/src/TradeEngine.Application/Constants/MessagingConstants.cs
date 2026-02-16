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
    
    // AI Analyst Configuration Keys
    public const string AiAnalystUrlConfigKey = "AiAnalyst:BaseUrl";
    
    // Defaults
    public const string DefaultHost = "localhost";
    public const string DefaultPort = "5672";
    public const string DefaultAiUrl = "http://ai-analyst:8000"; // Docker default

    // SignalR Methods (Frontend Listeners)
    public const string SignalRReceiveMethod = "ReceivePriceUpdate";
}