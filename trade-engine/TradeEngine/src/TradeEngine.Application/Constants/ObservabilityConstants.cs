namespace TradeEngine.Application.Constants;

public static class ObservabilityConstants
{
    public const string ServiceName = "TradeEngine";
    public const string ServiceVersion = "0.9.0";
    
    public const string OtlpEndpointConfigKey = "Otlp:Endpoint";
    public const string DefaultOtlpEndpoint = "http://otel-collector:4317";

    public const string ServiceNameConfigKey = "Otlp:ServiceName";
    public const string ServiceVersionConfigKey = "Otlp:ServiceVersion";
}