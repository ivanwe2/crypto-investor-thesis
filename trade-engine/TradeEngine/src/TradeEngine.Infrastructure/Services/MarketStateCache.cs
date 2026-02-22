using System.Collections.Concurrent;

namespace TradeEngine.Infrastructure.Services;

public interface IMarketStateCache
{
    void UpdatePrice(string symbol, decimal price);
    IReadOnlyDictionary<string, decimal> GetLatestPrices();
}

public class MarketStateCache : IMarketStateCache
{
    // A thread-safe dictionary to hold the latest price of every symbol in RAM
    private readonly ConcurrentDictionary<string, decimal> _prices = new();

    public void UpdatePrice(string symbol, decimal price)
    {
        _prices[symbol] = price;
    }

    public IReadOnlyDictionary<string, decimal> GetLatestPrices()
    {
        return _prices.AsReadOnly();
    }
}