using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;
using TradeEngine.Domain.Shared;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services.Orders;

namespace TradeEngine.Infrastructure.Services;

public class OrderService(
    TradeEngineDbContext dbContext,
    OrderIngressQueue ingressQueue,
    ICurrentUserService currentUserService) : IOrderService
{
    public async Task<Result<OrderResponse>> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken cancellationToken = default)
    {
        var userId = currentUserService.UserId;

        var wallet = await dbContext.Wallets
            .Include(w => w.Balances)
            .SingleOrDefaultAsync(w => w.UserId == userId, cancellationToken);

        if (wallet == null)
            return Result.Failure<OrderResponse>(new Error("Wallet.NotFound", "User wallet not found"));

        var symbol = request.Symbol.ToUpper();
        string quoteCurrency = symbol.EndsWith("USDT") ? "USDT" : "USD"; 
        string baseCurrency = symbol.Replace(quoteCurrency, "");
        // 3. Fund Locking Logic (Upfront validation)
        Result walletResult;
        
        if (request.Side == OrderSide.Buy)
        {
            if (request.Type == OrderType.Market)
            {
                return Result<OrderResponse>.Failure<OrderResponse>(new Error("Order.NotSupported", "Market orders are not yet supported in this version."));
            }

            decimal totalCost = request.Quantity * request.TargetPrice;
            walletResult = wallet.Withdraw(quoteCurrency, totalCost);
        }
        else
        {
            walletResult = wallet.Withdraw(baseCurrency, request.Quantity);
        }

        if (walletResult.IsFailure)
            return Result<OrderResponse>.Failure<OrderResponse>(walletResult.Error);

        var orderResult = Order.Create(userId, symbol, request.Side, request.Type, request.Quantity, request.TargetPrice);
        
        if (orderResult.IsFailure)
            return Result<OrderResponse>.Failure<OrderResponse>(orderResult.Error);

        var order = orderResult.Value;
        dbContext.Orders.Add(order);

        await dbContext.SaveChangesAsync(cancellationToken);

        ingressQueue.Writer.TryWrite(order);

        return new OrderResponse(order.Id, order.Status.ToString(), "Order placed and funds locked successfully.");
    }
}