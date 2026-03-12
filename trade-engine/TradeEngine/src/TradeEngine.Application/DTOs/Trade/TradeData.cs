namespace TradeEngine.Application.DTOs.Trade;

public readonly record struct TradeData(
    [property: JsonPropertyName("s")] string Symbol,
    [property: JsonPropertyName("p")] decimal Price,
    [property: JsonPropertyName("q")] decimal Quantity,
    [property: JsonPropertyName("T")] long TradeTime,
    [property: JsonPropertyName("v")] decimal? Volatility
);