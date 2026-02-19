using TradeEngine.Application.DTOs.Trade;

namespace TradeEngine.Application.Interfaces;

public interface IPriceBroadcaster
{
    Task BroadcastPriceAsync(TradeData tradeData);
}