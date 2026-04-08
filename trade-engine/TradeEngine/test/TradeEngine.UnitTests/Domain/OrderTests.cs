using FluentAssertions;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;

namespace TradeEngine.UnitTests.Domain;

public class OrderTests
{
    private static readonly Guid UserId = Guid.NewGuid();

    [Fact]
    public void Create_WithZeroQuantity_ReturnsFailure()
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Buy, OrderType.Market, quantity: 0);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Order.Invalid");
    }

    [Fact]
    public void Create_WithNegativeQuantity_ReturnsFailure()
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Buy, OrderType.Market, quantity: -1);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Create_LimitOrder_WithZeroTargetPrice_ReturnsFailure()
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Buy, OrderType.Limit, quantity: 1m, targetPrice: 0);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Order.Invalid");
    }

    [Theory]
    [InlineData(OrderType.StopLoss)]
    [InlineData(OrderType.TakeProfit)]
    public void Create_StopOrder_WithoutStopPrice_ReturnsFailure(OrderType type)
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Sell, type, quantity: 0.5m, targetPrice: 50000m, stopPrice: null);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Order.InvalidStop");
    }

    [Theory]
    [InlineData(OrderType.StopLoss)]
    [InlineData(OrderType.TakeProfit)]
    public void Create_StopOrder_WithZeroStopPrice_ReturnsFailure(OrderType type)
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Sell, type, quantity: 0.5m, targetPrice: 50000m, stopPrice: 0m);

        result.IsFailure.Should().BeTrue();
    }

    [Fact]
    public void Create_ValidLimitBuyOrder_Succeeds()
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Buy, OrderType.Limit, quantity: 0.1m, targetPrice: 45000m);

        result.IsSuccess.Should().BeTrue();
        result.Value.Symbol.Should().Be("BTCUSDT");
        result.Value.Side.Should().Be(OrderSide.Buy);
        result.Value.Type.Should().Be(OrderType.Limit);
        result.Value.Status.Should().Be(OrderStatus.Pending);
        result.Value.TargetPrice.Should().Be(45000m);
    }

    [Fact]
    public void Create_ValidMarketOrder_Succeeds()
    {
        var result = Order.Create(UserId, "ETHUSDT", OrderSide.Sell, OrderType.Market, quantity: 2m);

        result.IsSuccess.Should().BeTrue();
        result.Value.Type.Should().Be(OrderType.Market);
    }

    [Fact]
    public void Create_ValidStopLoss_Succeeds()
    {
        var result = Order.Create(UserId, "BTCUSDT", OrderSide.Sell, OrderType.StopLoss, quantity: 1m, targetPrice: 50000m, stopPrice: 45000m);

        result.IsSuccess.Should().BeTrue();
        result.Value.StopPrice.Should().Be(45000m);
    }

    [Fact]
    public void Create_SymbolIsUpperCased()
    {
        var result = Order.Create(UserId, "btcusdt", OrderSide.Buy, OrderType.Market, quantity: 1m);

        result.Value.Symbol.Should().Be("BTCUSDT");
    }
}
