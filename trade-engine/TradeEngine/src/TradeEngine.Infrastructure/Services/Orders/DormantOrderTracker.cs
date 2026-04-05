using System.Collections.Concurrent;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Infrastructure.Services.Orders;

public class DormantOrderTracker
{
    // Thesis Angle 17: Segregation of State.
    // Dormant orders are kept completely separate from the active L2 Limit Book.
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, Order>> _dormantOrders = new();

    public void Register(Order order)
    {
        var symbolOrders = _dormantOrders.GetOrAdd(order.Symbol, _ => new ConcurrentDictionary<Guid, Order>());
        symbolOrders.TryAdd(order.Id, order);
    }

    public IEnumerable<Order> EvaluateTriggers(string symbol, decimal currentPrice)
    {
        if (!_dormantOrders.TryGetValue(symbol, out var orders) || orders.IsEmpty)
        {
            return [];
        }

        var triggered = new List<Order>();

        foreach (var kvp in orders)
        {
            var order = kvp.Value;
            if (order.StopPrice == null) continue;

            bool isTriggered = false;

            if (order.Type == OrderType.StopLoss)
            {
                // Buy Stop-Loss: triggers when price rises to or above StopPrice (preventing further loss on a short)
                if (order.Side == OrderSide.Buy && currentPrice >= order.StopPrice) isTriggered = true;
                
                // Sell Stop-Loss: triggers when price falls to or below StopPrice (protecting a long position)
                if (order.Side == OrderSide.Sell && currentPrice <= order.StopPrice) isTriggered = true;
            }
            else if (order.Type == OrderType.TakeProfit)
            {
                // Buy Take-Profit: triggers when price falls to or below Target
                if (order.Side == OrderSide.Buy && currentPrice <= order.StopPrice) isTriggered = true;
                
                // Sell Take-Profit: triggers when price rises to or above Target
                if (order.Side == OrderSide.Sell && currentPrice >= order.StopPrice) isTriggered = true;
            }

            if (isTriggered)
            {
                triggered.Add(order);
                // O(1) Lock-free removal
                orders.TryRemove(kvp.Key, out _); 
            }
        }

        return triggered;
    }
}