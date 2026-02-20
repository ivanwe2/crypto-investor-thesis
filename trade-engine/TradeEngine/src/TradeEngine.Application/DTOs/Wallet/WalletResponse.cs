namespace TradeEngine.Application.DTOs.Wallet;

public record WalletResponse(Guid WalletId, List<AssetBalanceDto> Balances);