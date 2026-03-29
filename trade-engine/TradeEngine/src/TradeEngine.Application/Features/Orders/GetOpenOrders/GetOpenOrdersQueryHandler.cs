using MediatR;
using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Orders.GetOpenOrders;

public class GetOpenOrdersQueryHandler(
    IRedisReadModelService redisService,
    ITradeEngineDbContext dbContext) : IRequestHandler<GetOpenOrdersQuery, Result<List<OpenOrderDto>>>
{
    public async Task<Result<List<OpenOrderDto>>> Handle(GetOpenOrdersQuery request, CancellationToken cancellationToken)
    {
       // 🚀 1. Try Redis First
        var cachedOrders = await redisService.GetOpenOrdersAsync(request.UserId, cancellationToken);
        if (cachedOrders != null) return cachedOrders;

        // 🐢 2. Cache Miss - Fallback to Postgres (Strictly Pending only)
        var openOrders = await dbContext.Orders
            .AsNoTracking()
            .Where(o => o.UserId == request.UserId && o.Status == OrderStatus.Pending)
            .OrderByDescending(o => o.CreatedAt)
            .Select(o => new OpenOrderDto(o.Id, o.Symbol, o.Side.ToString(), o.Type.ToString(), o.Quantity, o.TargetPrice, o.Status.ToString(), o.CreatedAt, o.StopPrice))
            .ToListAsync(cancellationToken);

        // 3. Hydrate Cache
        await redisService.UpdateOpenOrdersAsync(request.UserId, openOrders, cancellationToken);

        return openOrders;
    }
}