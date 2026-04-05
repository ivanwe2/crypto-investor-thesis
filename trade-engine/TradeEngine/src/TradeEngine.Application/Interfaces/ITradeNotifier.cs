using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Interfaces;

public interface ITradeNotifier
{
    Task NotifyOrderFilledAsync(Guid userId, string symbol, decimal quantity, decimal price, OrderSide side);
    Task NotifyAiSignalAsync(string symbol, string signal, double confidence, string reason, string side, string timestamp);
}