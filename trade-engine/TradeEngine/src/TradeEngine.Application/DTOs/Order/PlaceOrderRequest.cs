using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.DTOs.Order;

public record PlaceOrderRequest(
    string Symbol, 
    OrderSide Side, 
    OrderType Type, 
    decimal Quantity, 
    decimal TargetPrice = 0,
    decimal? StopPrice = null);