namespace TradeEngine.Application.Interfaces;

public interface IMarketStateCache
{
    void UpdatePrice(string symbol, decimal price);
    IReadOnlyDictionary<string, decimal> GetLatestPrices();
}
