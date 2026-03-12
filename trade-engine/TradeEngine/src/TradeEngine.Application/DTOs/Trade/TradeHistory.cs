namespace TradeEngine.Application.DTOs.Trade;

public record TradeHistoryDto(
    Guid Id,
    string Symbol,
    string Side,
    string Type,
    decimal Quantity,
    decimal TargetPrice,
    decimal? ExecutionPrice,
    string Status,
    DateTime Timestamp
);