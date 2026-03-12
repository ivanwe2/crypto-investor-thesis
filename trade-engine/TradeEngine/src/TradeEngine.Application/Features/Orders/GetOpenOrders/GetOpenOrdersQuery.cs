using MediatR;
using TradeEngine.Application.DTOs.Order;

namespace TradeEngine.Application.Features.Orders.GetOpenOrders;

public record GetOpenOrdersQuery(Guid UserId) : IRequest<Result<List<OpenOrderDto>>>;