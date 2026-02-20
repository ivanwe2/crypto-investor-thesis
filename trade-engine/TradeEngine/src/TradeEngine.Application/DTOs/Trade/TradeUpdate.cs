namespace TradeEngine.Application.DTOs.Trade;

public record TradeUpdate(
    [property: JsonPropertyName("stream")] string Stream,
    [property: JsonPropertyName("data")] TradeData Data
);