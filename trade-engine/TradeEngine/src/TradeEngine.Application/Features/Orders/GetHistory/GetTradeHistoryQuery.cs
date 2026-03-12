using MediatR;
using TradeEngine.Application.DTOs.Trade;

namespace TradeEngine.Application.Features.Orders.GetHistory;

public record GetTradeHistoryQuery(Guid UserId, int Limit = 50) : IRequest<Result<List<TradeHistoryDto>>>;