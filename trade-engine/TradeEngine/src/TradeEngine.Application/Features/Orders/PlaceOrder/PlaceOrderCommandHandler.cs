using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Orders.PlaceOrder;

public class PlaceOrderCommandHandler(
    ITradeEngineDbContext dbContext,
    IOrderIngressQueue ingressQueue,
    IRedisReadModelService redisService,
    ILogger<PlaceOrderCommandHandler> logger) : IRequestHandler<PlaceOrderCommand, Result<OrderResponse>>
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
            if (request.TargetPrice <= 0)
                return Result.Failure<OrderResponse>(new Error("Order.InvalidPrice", "A reference target price must be provided to lock collateral."));

            decimal totalCost = request.Quantity * request.TargetPrice;
            walletResult = wallet.Withdraw(quoteCurrency, totalCost);
        }
        else
        {
            walletResult = wallet.Withdraw(baseCurrency, request.Quantity);
        }

        if (walletResult.IsFailure)
            return Result.Failure<OrderResponse>(walletResult.Error);

        var orderResult = Order.Create(request.UserId, symbol, request.Side, request.Type, request.Quantity, request.TargetPrice, request.StopPrice);
        
        if (orderResult.IsFailure)
            return Result.Failure<OrderResponse>(orderResult.Error);

        var order = orderResult.Value;
        dbContext.Orders.Add(order);

        await dbContext.SaveChangesAsync(cancellationToken);

        try 
        {
            var orderDto = new OpenOrderDto(
                order.Id,
                order.Symbol,
                order.Side.ToString(), 
                order.Type.ToString(),
                order.Quantity,
                order.TargetPrice,
                order.Status.ToString(), 
                order.CreatedAt);
                
            await redisService.AddOpenOrderAsync(request.UserId, orderDto, cancellationToken);

            var balances = wallet.Balances.Select(b => new AssetBalanceDto(b.Currency, b.Amount)).ToList();
            var walletResponse = new WalletResponse(wallet.Id, balances);
            
            await redisService.UpdateUserPortfolioAsync(request.UserId, walletResponse, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to update Redis synchronously for order {OrderId}", order.Id);
        }

        ingressQueue.Writer.TryWrite(order);

        return new OrderResponse(order.Id, order.Status.ToString(), "Order placed and funds locked successfully.");
    }
}