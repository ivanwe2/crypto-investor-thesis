using MediatR;
using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Orders;

public class PlaceOrderCommandHandler(
    ITradeEngineDbContext dbContext,
    IOrderIngressQueue ingressQueue) : IRequestHandler<PlaceOrderCommand, Result<OrderResponse>>
{
    public async Task<Result<OrderResponse>> Handle(PlaceOrderCommand request, CancellationToken cancellationToken)
    {
        var wallet = await dbContext.Wallets
            .Include(w => w.Balances)
            .SingleOrDefaultAsync(w => w.UserId == request.UserId, cancellationToken);

        if (wallet == null)
            return Result.Failure<OrderResponse>(new Error("Wallet.NotFound", "User wallet not found"));

        var symbol = request.Symbol.ToUpper();
        string quoteCurrency = symbol.EndsWith("USDT") ? "USDT" : "USD"; 
        string baseCurrency = symbol.Replace(quoteCurrency, "");
        
        Result walletResult;
        
        if (request.Side == OrderSide.Buy)
        {
            if (request.Type == OrderType.Market)
                return Result.Failure<OrderResponse>(new Error("Order.NotSupported", "Market orders are not yet supported."));

            decimal totalCost = request.Quantity * request.TargetPrice;
            walletResult = wallet.Withdraw(quoteCurrency, totalCost);
        }
        else
        {
            walletResult = wallet.Withdraw(baseCurrency, request.Quantity);
        }

        if (walletResult.IsFailure)
            return Result.Failure<OrderResponse>(walletResult.Error);

        var orderResult = Order.Create(request.UserId, symbol, request.Side, request.Type, request.Quantity, request.TargetPrice);
        
        if (orderResult.IsFailure)
            return Result.Failure<OrderResponse>(orderResult.Error);

        var order = orderResult.Value;
        dbContext.Orders.Add(order);

        await dbContext.SaveChangesAsync(cancellationToken);

        // Instantly push to the blazing fast RAM matcher
        ingressQueue.Writer.TryWrite(order);

        return new OrderResponse(order.Id, order.Status.ToString(), "Order placed and funds locked successfully.");
    }
}