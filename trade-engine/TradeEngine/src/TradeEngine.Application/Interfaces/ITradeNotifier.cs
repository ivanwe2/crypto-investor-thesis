namespace TradeEngine.Application.Interfaces;

public interface ITradeNotifier
{
    Task NotifyOrderFilledAsync(Guid userId, string symbol, decimal quantity, decimal price);
    Task NotifyAiSignalAsync(string symbol, string signal, double confidence, string reason);
}