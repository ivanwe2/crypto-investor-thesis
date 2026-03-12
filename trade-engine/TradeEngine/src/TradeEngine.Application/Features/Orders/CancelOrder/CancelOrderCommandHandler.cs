using MediatR;
using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Orders.CancelOrder;

public class CancelOrderCommandHandler(
    ITradeEngineDbContext dbContext,
    IRedisReadModelService redisService) : IRequestHandler<CancelOrderCommand, Result>
{
    public async Task<Result> Handle(CancelOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await dbContext.Orders
            .SingleOrDefaultAsync(o => o.Id == request.OrderId && o.UserId == request.UserId, cancellationToken);

        if (order == null) return Result.Failure(new Error("Order.NotFound", "Order not found."));
        if (order.Status != OrderStatus.Pending) return Result.Failure(new Error("Order.CannotCancel", "Only pending orders can be cancelled."));

        // 1. Cancel the Order
        var result = order.Cancel();
        if (result.IsFailure)
        {
            throw new ArgumentException("Could not cancel order!");
        }

        // 2. Refund the Wallet
        var wallet = await dbContext.Wallets.Include(w => w.Balances).SingleAsync(w => w.UserId == request.UserId, cancellationToken);

        var (baseCurrency, quoteCurrency) = ParseSymbol(order.Symbol);

        if (order.Side == OrderSide.Buy)
        {
            decimal refundAmount = order.Quantity * order.TargetPrice;
            wallet.Deposit(quoteCurrency, refundAmount);
        }
        else
        {
            wallet.Deposit(baseCurrency, order.Quantity);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        // 3. Invalidate Redis Caches so the UI updates instantly on next fetch
        await redisService.UpdateOpenOrdersAsync(request.UserId, null!, cancellationToken);
        await redisService.UpdateUserPortfolioAsync(request.UserId, null!, cancellationToken);

        return Result.Success();
    }

    // Helper method to dynamically extract base and quote currencies
    private static (string Base, string Quote) ParseSymbol(string symbol)
    {
        // Common quote currencies in trading
        string[] commonQuotes = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH"];

        // Find the first matching quote suffix, or fallback to the last 3 chars
        string quote = commonQuotes.FirstOrDefault(symbol.EndsWith) ?? symbol[^3..];
        string @base = symbol[..^quote.Length];

        return (@base, quote);
    }
}