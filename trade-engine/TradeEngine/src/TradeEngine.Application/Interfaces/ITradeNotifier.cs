namespace TradeEngine.Application.Interfaces;

public interface ITradeNotifier
{
    Task NotifyOrderFilledAsync(Guid userId, string symbol, decimal quantity, decimal price);
}