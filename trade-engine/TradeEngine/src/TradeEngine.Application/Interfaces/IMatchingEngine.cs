using TradeEngine.Application.DTOs.Trade;

namespace TradeEngine.Application.Interfaces;

public interface IMatchingEngine
{
    Task ProcessTickAsync(TradeData tick, CancellationToken cancellationToken = default);
}