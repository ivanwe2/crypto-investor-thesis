namespace TradeEngine.Application.DTOs.Order;

public record OrderResponse(Guid OrderId, string Status, string Message);