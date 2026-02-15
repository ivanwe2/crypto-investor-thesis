namespace TradeEngine.Application.DTOs;

public record TradeUpdate(
    [property: JsonPropertyName("stream")] string Stream,
    [property: JsonPropertyName("data")] TradeData Data
);