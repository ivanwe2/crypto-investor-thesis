using MediatR;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Orders.PlaceOrder;

public record PlaceOrderCommand(
    Guid UserId,
    string Symbol,
    OrderSide Side,
    OrderType Type,
    decimal Quantity,
    decimal TargetPrice,
    decimal? StopPrice = null) : IRequest<Result<OrderResponse>>;