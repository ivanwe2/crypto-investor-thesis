namespace TradeEngine.Domain.Entities;

public class AssetBalance
{
    public Guid Id { get; private set; }
    public Guid WalletId { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }

    private AssetBalance() { }

    public AssetBalance(Guid walletId, string currency)
    {
        Id = Guid.NewGuid();
        WalletId = walletId;
        Currency = currency.ToUpper();
        Amount = 0;
    }

    public void Add(decimal quantity) => Amount += quantity;
    internal void Subtract(decimal quantity) => Amount -= quantity;
}
