using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Diagnostics.Metrics;
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
    IMeterFactory meterFactory,
    ILogger<PlaceOrderCommandHandler> logger) : IRequestHandler<PlaceOrderCommand, Result<OrderResponse>>
{
    private readonly Counter<long> _ordersRejected = meterFactory
        .Create("TradeEngine.Trading")
        .CreateCounter<long>("trade_engine.orders_rejected", description: "Orders rejected at placement by reason");

    private const int MaxConcurrencyRetries = 3;

    public async Task<Result<OrderResponse>> Handle(PlaceOrderCommand request, CancellationToken cancellationToken)
    {
        var symbol = request.Symbol.ToUpper();
        string quoteCurrency = symbol.EndsWith("USDT") ? "USDT" : "USD";
        string baseCurrency = symbol.Replace(quoteCurrency, "");

        if (request.Side == OrderSide.Buy && request.TargetPrice <= 0)
            return Result.Failure<OrderResponse>(new Error("Order.InvalidPrice", "A reference target price must be provided to lock collateral."));

        Order? order = null;
        Wallet? wallet = null;

        for (int attempt = 1; attempt <= MaxConcurrencyRetries; attempt++)
        {
            wallet = await dbContext.Wallets
                .Include(w => w.Balances)
                .SingleOrDefaultAsync(w => w.UserId == request.UserId, cancellationToken);

            if (wallet == null)
                return Result.Failure<OrderResponse>(new Error("Wallet.NotFound", "User wallet not found"));

            Result walletResult = request.Side == OrderSide.Buy
                ? wallet.Withdraw(quoteCurrency, request.Quantity * request.TargetPrice)
                : wallet.Withdraw(baseCurrency, request.Quantity);

            if (walletResult.IsFailure)
            {
                _ordersRejected.Add(1, new KeyValuePair<string, object?>("rejection_reason", "insufficient_balance"));
                return Result.Failure<OrderResponse>(walletResult.Error);
            }

            var orderResult = Order.Create(request.UserId, symbol, request.Side, request.Type, request.Quantity, request.TargetPrice, request.StopPrice);
            if (orderResult.IsFailure)
                return Result.Failure<OrderResponse>(orderResult.Error);

            order = orderResult.Value;
            dbContext.Orders.Add(order);

            try
            {
                await dbContext.SaveChangesAsync(cancellationToken);
                break;
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyRetries)
            {
                logger.LogWarning("Wallet concurrency conflict on order placement (attempt {Attempt}/{Max}), retrying.", attempt, MaxConcurrencyRetries);
                dbContext.Orders.Remove(order);
                order = null;
            }
            catch (DbUpdateConcurrencyException)
            {
                logger.LogError("Wallet concurrency conflict exhausted retries for user {UserId}.", request.UserId);
                return Result.Failure<OrderResponse>(new Error("Order.ConcurrencyConflict", "Concurrent modification detected, please retry."));
            }
        }

        // order and wallet are guaranteed non-null here — all failure paths return early above
        if (order is null || wallet is null)
            return Result.Failure<OrderResponse>(new Error("Order.UnexpectedError", "Failed to place order."));

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
                order.CreatedAt,
                order.StopPrice);
                
            await redisService.AddOpenOrderAsync(request.UserId, orderDto, cancellationToken);

            var balances = wallet.Balances.Select(b => new AssetBalanceDto(b.Currency, b.Amount, 0, null)).ToList();
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