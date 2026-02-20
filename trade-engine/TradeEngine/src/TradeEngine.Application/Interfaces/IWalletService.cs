using TradeEngine.Application.DTOs.Wallet;

namespace TradeEngine.Application.Interfaces;

public interface IWalletService
{
    Task<Result<WalletResponse>> GetMyWalletAsync(CancellationToken cancellationToken = default);
}