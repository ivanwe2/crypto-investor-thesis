using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.DTOs.Wallet;

namespace TradeEngine.Application.Interfaces;

public interface IRedisReadModelService
{
    Task<WalletResponse?> GetUserPortfolioAsync(Guid userId, CancellationToken ct = default);
    Task UpdateUserPortfolioAsync(Guid userId, WalletResponse portfolio, CancellationToken ct = default);
    Task<List<OpenOrderDto>?> GetOpenOrdersAsync(Guid userId, CancellationToken ct = default);
    Task UpdateOpenOrdersAsync(Guid userId, List<OpenOrderDto> orders, CancellationToken ct = default);
    Task AddOpenOrderAsync(Guid userId, OpenOrderDto order, CancellationToken ct = default);
    Task RemoveOpenOrderAsync(Guid userId, Guid orderId, CancellationToken ct = default);
    void RecordCacheHit();
    void RecordCacheMiss();
}