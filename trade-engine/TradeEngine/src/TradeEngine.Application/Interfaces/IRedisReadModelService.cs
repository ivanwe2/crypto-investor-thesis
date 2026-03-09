using TradeEngine.Application.DTOs.Wallet;

namespace TradeEngine.Application.Interfaces;

public interface IRedisReadModelService
{
    // Portfolio Queries
    Task<WalletResponse?> GetUserPortfolioAsync(Guid userId, CancellationToken ct = default);
    Task UpdateUserPortfolioAsync(Guid userId, WalletResponse portfolio, CancellationToken ct = default);

    // Metrics
    void RecordCacheHit();
    void RecordCacheMiss();
}