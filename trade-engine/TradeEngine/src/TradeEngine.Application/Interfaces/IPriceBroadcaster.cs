namespace TradeEngine.Application.Interfaces;

public interface IPriceBroadcaster
{
    Task BroadcastPriceAsync(TradeData tradeData);
}