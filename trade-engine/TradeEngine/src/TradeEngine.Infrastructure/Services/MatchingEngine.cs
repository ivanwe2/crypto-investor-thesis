using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Persistence;

namespace TradeEngine.Infrastructure.Services;

public class MatchingEngine(
    TradeEngineDbContext dbContext,
    ITradeNotifier tradeNotifier,
    ILogger<MatchingEngine> logger) : IMatchingEngine
{
    public async Task ProcessTickAsync(TradeData tick, CancellationToken cancellationToken = default)
    {
        var matchingOrders = await dbContext.Orders
            .Where(o => o.Status == OrderStatus.Pending && o.Symbol == tick.Symbol)
            .Where(o => (o.Side == OrderSide.Buy && tick.Price <= o.TargetPrice) ||
                        (o.Side == OrderSide.Sell && tick.Price >= o.TargetPrice))
            .ToListAsync(cancellationToken);

        if (matchingOrders.Count == 0) return;

        foreach (var order in matchingOrders)
        {
            var fillResult = order.Fill(tick.Price);
            if (fillResult.IsFailure)
            {
                logger.LogWarning("[WARN] Failed to fill order {OrderId}: {Error}", order.Id, fillResult.Error.Name);
                continue;
            }

            var wallet = await dbContext.Wallets
                .Include(w => w.Balances)
                .SingleOrDefaultAsync(w => w.UserId == order.UserId, cancellationToken);

            if (wallet == null) continue;

            string quoteCurrency = order.Symbol.EndsWith("USDT") ? "USDT" : "USD";
            string baseCurrency = order.Symbol.Replace(quoteCurrency, "");

            if (order.Side == OrderSide.Buy)
            {
                // When they placed the buy order, we locked (TargetPrice * Quantity) of Quote currency.
                // If it executed at a better (lower) price, refund the difference.
                decimal lockedQuote = order.Quantity * order.TargetPrice;
                decimal actualCost = order.Quantity * tick.Price;
                decimal refundQuote = lockedQuote - actualCost;

                if (refundQuote > 0)
                {
                    wallet.Deposit(quoteCurrency, refundQuote);
                }
                
                // Give them the asset they bought
                wallet.Deposit(baseCurrency, order.Quantity);
            }
            else
            {
                // Sell Order: They previously locked the Base asset. We give them the Quote revenue.
                decimal revenueQuote = order.Quantity * tick.Price;
                wallet.Deposit(quoteCurrency, revenueQuote);
            }

            logger.LogInformation("[INFO] Order {OrderId} Executed! {Side} {Quantity} {Symbol} @ {Price}", 
                order.Id, order.Side, order.Quantity, order.Symbol, tick.Price);

            // 4. Notify the user instantly
            await tradeNotifier.NotifyOrderFilledAsync(order.UserId, order.Symbol, order.Quantity, tick.Price);
        }

        // 5. Commit all changes transactionally
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}