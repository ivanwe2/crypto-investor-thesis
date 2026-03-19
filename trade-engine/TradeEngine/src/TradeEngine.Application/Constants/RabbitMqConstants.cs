namespace TradeEngine.Application.Constants;

public static class RabbitMqConstants
{
    public const string ExchangeName = "crypto_prices";
    public const string QueueName = "trade_engine_queue";
    public const string RoutingKey = "";
    
    public const string HostConfigKey = "RabbitMq:Host";
    public const string PortConfigKey = "RabbitMq:Port";
    public const string UsernameConfigKey = "RabbitMq:Username";
    public const string PasswordConfigKey = "RabbitMq:Password";
    
    public const string ManagementUrlConfigKey = "RabbitMq:ManagementUrl";

    public const string DefaultHost = "localhost";
    public const string DefaultPort = "5672";
    
    public const string DefaultUsername = "user";
    public const string DefaultPassword = "password";
    
    public const string DefaultManagementUrl = "http://localhost:15672/api/queues/%2f/trade_engine_queue";
}