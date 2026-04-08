using FluentAssertions;
using TradeEngine.Domain.Entities;

namespace TradeEngine.UnitTests.Domain;

public class WalletTests
{
    private static Wallet CreateWalletWithBalance(string currency, decimal amount)
    {
        var wallet = new Wallet(Guid.NewGuid());
        wallet.Deposit(currency, amount);
        return wallet;
    }

    [Fact]
    public void Withdraw_WithNoCurrencyBalance_ReturnsFailure()
    {
        var wallet = new Wallet(Guid.NewGuid());

        var result = wallet.Withdraw("USDT", 100m);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Wallet.InsufficientFunds");
    }

    [Fact]
    public void Withdraw_WithInsufficientBalance_ReturnsFailure()
    {
        var wallet = CreateWalletWithBalance("USDT", 50m);

        var result = wallet.Withdraw("USDT", 100m);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Wallet.InsufficientFunds");
    }

    [Fact]
    public void Withdraw_WithNegativeAmount_ReturnsFailure()
    {
        var wallet = CreateWalletWithBalance("USDT", 1000m);

        var result = wallet.Withdraw("USDT", -50m);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Wallet.InvalidAmount");
    }

    [Fact]
    public void Withdraw_WithZeroAmount_ReturnsFailure()
    {
        var wallet = CreateWalletWithBalance("USDT", 1000m);

        var result = wallet.Withdraw("USDT", 0m);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Withdraw_WithExactBalance_Succeeds_AndZerosBalance()
    {
        var wallet = CreateWalletWithBalance("USDT", 100m);

        var result = wallet.Withdraw("USDT", 100m);

        result.IsSuccess.Should().BeTrue();
        wallet.Balances.Single(b => b.Currency == "USDT").Amount.Should().Be(0m);
    }

    [Fact]
    public void Withdraw_WithSufficientBalance_Succeeds_AndReducesCorrectly()
    {
        var wallet = CreateWalletWithBalance("USDT", 500m);

        var result = wallet.Withdraw("USDT", 200m);

        result.IsSuccess.Should().BeTrue();
        wallet.Balances.Single(b => b.Currency == "USDT").Amount.Should().Be(300m);
    }

    [Fact]
    public void Withdraw_OnlyAffectsSpecifiedCurrency()
    {
        var wallet = new Wallet(Guid.NewGuid());
        wallet.Deposit("USDT", 1000m);
        wallet.Deposit("BTC", 0.5m);

        wallet.Withdraw("USDT", 300m);

        wallet.Balances.Single(b => b.Currency == "BTC").Amount.Should().Be(0.5m);
        wallet.Balances.Single(b => b.Currency == "USDT").Amount.Should().Be(700m);
    }

    [Fact]
    public void Deposit_WithNegativeAmount_ReturnsFailure()
    {
        var wallet = new Wallet(Guid.NewGuid());

        var result = wallet.Deposit("USDT", -10m);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Wallet.InvalidAmount");
    }
}
