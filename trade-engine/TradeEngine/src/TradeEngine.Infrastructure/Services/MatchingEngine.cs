using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
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

        var successfullyFilledOrders = new List<Order>();

        foreach (var order in matchingOrders)
        {
            // 2. Mark order as Filled
            var fillResult = order.Fill(tick.Price);
            if (fillResult.IsFailure) continue;

            // 3. Load Wallet and distribute funds
            var wallet = await dbContext.Wallets
                .Include(w => w.Balances)
                .SingleOrDefaultAsync(w => w.UserId == order.UserId, cancellationToken);

            if (wallet == null) continue;

            string quoteCurrency = order.Symbol.EndsWith("USDT") ? "USDT" : "USD";
            string baseCurrency = order.Symbol.Replace(quoteCurrency, "");

            if (order.Side == OrderSide.Buy)
            {
                decimal lockedQuote = order.Quantity * order.TargetPrice;
                decimal actualCost = order.Quantity * tick.Price;
                decimal refundQuote = lockedQuote - actualCost;

                if (refundQuote > 0) wallet.Deposit(quoteCurrency, refundQuote);
                wallet.Deposit(baseCurrency, order.Quantity);
            }
            else
            {
                decimal revenueQuote = order.Quantity * tick.Price;
                wallet.Deposit(quoteCurrency, revenueQuote);
            }

            successfullyFilledOrders.Add(order);
        }

        if (successfullyFilledOrders.Count == 0) return;

        try
        {
            // 4. Commit all changes transactionally
            await dbContext.SaveChangesAsync(cancellationToken);

            // 5. ✨ CRITICAL: ONLY notify the user AFTER the database transaction succeeds!
            foreach (var order in successfullyFilledOrders)
            {
                logger.LogInformation("[INFO] Order {OrderId} Executed! {Side} {Quantity} {Symbol} @ {Price}", 
                    order.Id, order.Side, order.Quantity, order.Symbol, tick.Price);

                await tradeNotifier.NotifyOrderFilledAsync(order.UserId, order.Symbol, order.Quantity, tick.Price);
            }
        }
        catch (DbUpdateConcurrencyException)
        {
            logger.LogDebug("[DEBUG] Concurrency conflict avoided. Order was already processed by another tick.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "[ERROR] An unexpected error occurred while saving the matching order.");
        }
    }
}