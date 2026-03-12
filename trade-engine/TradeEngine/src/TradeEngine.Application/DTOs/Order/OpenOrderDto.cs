namespace TradeEngine.Application.DTOs.Order;

public record OpenOrderDto(
    Guid Id,
    string Symbol,
    string Side,
    string Type,
    decimal Quantity,
    decimal TargetPrice,
    string Status,
    DateTime CreatedAtUtc
);