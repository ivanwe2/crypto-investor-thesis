namespace TradeEngine.Domain.Entities;

public class Order
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public string Symbol { get; private set; } = string.Empty;
    public OrderSide Side { get; private set; }
    public OrderType Type { get; private set; }
    
    public decimal Quantity { get; private set; }
    public decimal TargetPrice { get; private set; }
    public decimal? StopPrice { get; private set; }
    public decimal? ExecutionPrice { get; private set; }
    
    public OrderStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ExecutedAt { get; private set; }

    private Order() { }

    public static Result<Order> Create(Guid userId, string symbol, OrderSide side, OrderType type, decimal quantity, decimal targetPrice = 0, decimal? stopPrice = null)
    {
        if (quantity <= 0)
            return Result<Order>.Failure<Order>(new Error("Order.Invalid", "Quantity must be greater than zero"));

        if (type == OrderType.Limit && targetPrice <= 0)
            return Result<Order>.Failure<Order>(new Error("Order.Invalid", "Limit orders must have a positive target price"));

        if ((type == OrderType.StopLoss || type == OrderType.TakeProfit) && (stopPrice == null || stopPrice <= 0))
                    return Result<Order>.Failure<Order>(new Error("Order.InvalidStop", "Stop-Loss and Take-Profit orders require a positive stop price"));

        return new Order
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Symbol = symbol.ToUpper(),
            Side = side,
            Type = type,
            Quantity = quantity,
            TargetPrice = targetPrice,
            StopPrice = stopPrice,
            Status = OrderStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    public Result Fill(decimal executionPrice)
    {
        if (Status != OrderStatus.Pending)
            return Result.Failure(new Error("Order.InvalidState", $"Cannot fill an order in {Status} state"));

        if (executionPrice <= 0)
            return Result.Failure(new Error("Order.InvalidPrice", "Execution price must be greater than zero"));

        Status = OrderStatus.Filled;
        ExecutionPrice = executionPrice;
        ExecutedAt = DateTime.UtcNow;

        return Result.Success();
    }

    public Result Cancel()
    {
        if (Status != OrderStatus.Pending)
            return Result.Failure(new Error("Order.InvalidState", $"Cannot cancel an order in {Status} state"));

        Status = OrderStatus.Cancelled;
        return Result.Success();
    }
}