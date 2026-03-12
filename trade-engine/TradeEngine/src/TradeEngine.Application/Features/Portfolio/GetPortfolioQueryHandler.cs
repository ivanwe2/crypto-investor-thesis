using MediatR;
using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Application.Features.Portfolio;

public class GetPortfolioQueryHandler(
    IRedisReadModelService redisService,
    ITradeEngineDbContext dbContext
    ) : IRequestHandler<GetPortfolioQuery, Result<WalletResponse>>
{
    public async Task<Result<WalletResponse>> Handle(GetPortfolioQuery request, CancellationToken cancellationToken)
    {
        // 🚀 Attempt to read from the blazing-fast Redis cache first
        var cachedPortfolio = await redisService.GetUserPortfolioAsync(request.UserId, cancellationToken);
        
        if (cachedPortfolio != null)
        {
            return cachedPortfolio; // ~1ms latency
        }

        // 🐢 Fallback: Query the database directly (Cache Miss)
        var wallet = await dbContext.Wallets
            .Include(w => w.Balances)
            .AsNoTracking() // CRITICAL for read-only queries
            .SingleOrDefaultAsync(w => w.UserId == request.UserId, cancellationToken);

        if (wallet != null)
        {
            var balances = wallet.Balances
                .Select(b => new AssetBalanceDto(b.Currency, b.Amount))
                .ToList();

            var response = new WalletResponse(wallet.Id, balances);

            // Hydrate the cache so the next request is fast
            await redisService.UpdateUserPortfolioAsync(request.UserId, response, cancellationToken);
            return response;
        }

        return Result.Failure<WalletResponse>(new Error("Portfolio.NotFound", "Could not retrieve portfolio."));
    }
}