using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Shared;
using TradeEngine.Infrastructure.Persistence;

namespace TradeEngine.Infrastructure.Services;

public class WalletService(TradeEngineDbContext dbContext, ICurrentUserService currentUserService) : IWalletService
{
    public async Task<Result<WalletResponse>> GetMyWalletAsync(CancellationToken cancellationToken = default)
    {
        var userId = currentUserService.UserId;

        var wallet = await dbContext.Wallets
            .Include(w => w.Balances)
            .AsNoTracking()
            .SingleOrDefaultAsync(w => w.UserId == userId, cancellationToken);

        if (wallet == null)
            return Result.Failure<WalletResponse>(new Error("Wallet.NotFound", "Wallet not found for this user"));

        var balances = wallet.Balances
            .Select(b => new AssetBalanceDto(b.Currency, b.Amount))
            .ToList();

        return new WalletResponse(wallet.Id, balances);
    }
}