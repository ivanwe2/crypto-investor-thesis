using TradeEngine.Domain.Shared;

namespace TradeEngine.Domain.Entities;

public class Wallet
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }

    public uint Version { get; set; }

    private readonly List<AssetBalance> _balances = [];
    public IReadOnlyCollection<AssetBalance> Balances => _balances.AsReadOnly();

    private Wallet() { }

    public Wallet(Guid userId)
    {
        Id = Guid.NewGuid();
        UserId = userId;
    }

    public Result Deposit(string currency, decimal amount)
    {
        if (amount <= 0)
        {
            return Result.Failure(new Error("Wallet.InvalidAmount", "Deposit amount must be positive"));
        }

        var balance = _balances.FirstOrDefault(x => x.Currency == currency);
        if (balance == null)
        {
            balance = new AssetBalance(Id, currency);
            _balances.Add(balance);
        }

        balance.Add(amount);
        return Result.Success();
    }

    public Result Withdraw(string currency, decimal amount)
    {
        if (amount <= 0)
        {
            return Result.Failure(new Error("Wallet.InvalidAmount", "Withdraw amount must be positive"));
        }

        var balance = _balances.FirstOrDefault(x => x.Currency == currency);

        if (balance == null || balance.Amount < amount)
        {
            return Result.Failure(new Error("Wallet.InsufficientFunds", $"Insufficient {currency} funds"));
        }

        balance.Subtract(amount);
        return Result.Success();
    }
}