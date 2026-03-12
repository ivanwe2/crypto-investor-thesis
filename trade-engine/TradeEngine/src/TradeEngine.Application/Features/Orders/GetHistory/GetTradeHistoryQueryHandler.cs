using MediatR;
using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Orders.GetHistory;

public class GetTradeHistoryQueryHandler(ITradeEngineDbContext dbContext)
    : IRequestHandler<GetTradeHistoryQuery, Result<List<TradeHistoryDto>>>
{
    public async Task<Result<List<TradeHistoryDto>>> Handle(GetTradeHistoryQuery request, CancellationToken cancellationToken)
    {
        var history = await dbContext.Orders
            .AsNoTracking()
            .Where(o => o.UserId == request.UserId &&
                       (o.Status == OrderStatus.Filled || o.Status == OrderStatus.Cancelled))
            .OrderByDescending(o => o.ExecutedAt ?? o.CreatedAt)
            .Take(request.Limit)
            .Select(o => new TradeHistoryDto(
                o.Id,
                o.Symbol,
                o.Side.ToString(),
                o.Type.ToString(),
                o.Quantity,
                o.TargetPrice,
                o.ExecutionPrice,
                o.Status.ToString(),
                o.ExecutedAt ?? o.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return Result.Success(history);
    }
}