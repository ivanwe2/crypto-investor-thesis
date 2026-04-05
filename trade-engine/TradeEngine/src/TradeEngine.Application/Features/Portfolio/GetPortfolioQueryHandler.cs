using MediatR;
using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Application.Features.Portfolio;

public class GetPortfolioQueryHandler(
    IRedisReadModelService redisService,
    ITradeEngineDbContext dbContext,
    IMarketStateCache marketStateCache
    ) : IRequestHandler<GetPortfolioQuery, Result<WalletResponse>>
{
    public async Task<Result<WalletResponse>> Handle(GetPortfolioQuery request, CancellationToken cancellationToken)
    {
        // Try Redis cache first for raw balances
        var cachedPortfolio = await redisService.GetUserPortfolioAsync(request.UserId, cancellationToken);

        List<AssetBalanceDto> rawBalances;
        Guid walletId;

        if (cachedPortfolio != null)
        {
            walletId = cachedPortfolio.WalletId;
            rawBalances = cachedPortfolio.Balances;
        }
        else
        {
            var wallet = await dbContext.Wallets
                .Include(w => w.Balances)
                .AsNoTracking()
                .SingleOrDefaultAsync(w => w.UserId == request.UserId, cancellationToken);

            if (wallet == null)
                return Result.Failure<WalletResponse>(new Error("Portfolio.NotFound", "Could not retrieve portfolio."));

            walletId = wallet.Id;
            rawBalances = wallet.Balances
                .Select(b => new AssetBalanceDto(b.Currency, b.Amount, 0, null))
                .ToList();
        }

        // Enrich with current market prices and average entry prices
        var latestPrices = marketStateCache.GetLatestPrices();

        var entryPrices = await dbContext.Orders
            .AsNoTracking()
            .Where(o => o.UserId == request.UserId && o.Side == OrderSide.Buy && o.Status == OrderStatus.Filled)
            .GroupBy(o => o.Symbol)
            .Select(g => new
            {
                Symbol = g.Key,
                Vwap = g.Sum(o => o.ExecutionPrice!.Value * o.Quantity) / g.Sum(o => o.Quantity)
            })
            .ToListAsync(cancellationToken);

        var entryPriceMap = entryPrices.ToDictionary(
            e => e.Symbol.Replace("USDT", "").Replace("USD", ""),
            e => e.Vwap);

        var enrichedBalances = rawBalances.Select(b =>
        {
            bool isQuote = b.Currency is "USDT" or "USD";
            decimal currentPrice = isQuote
                ? 1m
                : latestPrices.GetValueOrDefault($"{b.Currency}USDT", b.CurrentPrice);

            decimal? avgEntry = isQuote
                ? null
                : entryPriceMap.TryGetValue(b.Currency, out var vwap) ? vwap : null;

            return new AssetBalanceDto(b.Currency, b.Amount, currentPrice, avgEntry);
        }).ToList();

        var response = new WalletResponse(walletId, enrichedBalances);

        // Update cache with enriched data
        await redisService.UpdateUserPortfolioAsync(request.UserId, response, cancellationToken);
        return response;
    }
}