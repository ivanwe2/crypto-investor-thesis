using MediatR;

namespace TradeEngine.Application.Features.Orders.CancelOrder;

public record CancelOrderCommand(Guid OrderId, Guid UserId) : IRequest<Result>;