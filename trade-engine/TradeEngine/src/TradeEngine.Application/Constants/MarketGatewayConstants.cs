namespace TradeEngine.Application.Constants;

public static class MarketGatewayConstants
{
    public const string UrlConfigKey = "MarketGateway:Url";
    
    public const string HealthUrlConfigKey = "MarketGateway:HealthUrl";

    public const string DefaultUrl = "http://localhost:50051";
    public const string DefaultHealthUrl = "http://localhost:8080/healthz";
}