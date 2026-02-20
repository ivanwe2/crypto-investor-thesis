using TradeEngine.Application.DTOs.Order;

namespace TradeEngine.Application.Interfaces;

public interface IOrderService
{
    Task<Result<OrderResponse>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken = default);
}