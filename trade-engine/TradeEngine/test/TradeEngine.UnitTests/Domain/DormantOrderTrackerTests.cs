using FluentAssertions;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;
using TradeEngine.Infrastructure.Services.Orders;

namespace TradeEngine.UnitTests.Domain;

public class DormantOrderTrackerTests
{
    private static Order MakeOrder(OrderSide side, OrderType type, decimal stopPrice) =>
        Order.Create(Guid.NewGuid(), "BTCUSDT", side, type, quantity: 1m, targetPrice: 50000m, stopPrice: stopPrice).Value;

    [Fact]
    public void EvaluateTriggers_EmptySymbol_ReturnsEmpty()
    {
        var tracker = new DormantOrderTracker();

        var result = tracker.EvaluateTriggers("BTCUSDT", 50000m);

        result.Should().BeEmpty();
    }

    [Theory]
    [InlineData(50000, 50000, true)]   // at stop
    [InlineData(51000, 50000, true)]   // above stop
    [InlineData(49000, 50000, false)]  // below stop
    public void StopLoss_Buy_TriggersWhenPriceAtOrAboveStopPrice(decimal currentPrice, decimal stopPrice, bool shouldTrigger)
    {
        var tracker = new DormantOrderTracker();
        tracker.Register(MakeOrder(OrderSide.Buy, OrderType.StopLoss, stopPrice));

        var triggered = tracker.EvaluateTriggers("BTCUSDT", currentPrice).ToList();

        triggered.Should().HaveCount(shouldTrigger ? 1 : 0);
    }

    [Theory]
    [InlineData(45000, 45000, true)]   // at stop
    [InlineData(44000, 45000, true)]   // below stop
    [InlineData(46000, 45000, false)]  // above stop
    public void StopLoss_Sell_TriggersWhenPriceAtOrBelowStopPrice(decimal currentPrice, decimal stopPrice, bool shouldTrigger)
    {
        var tracker = new DormantOrderTracker();
        tracker.Register(MakeOrder(OrderSide.Sell, OrderType.StopLoss, stopPrice));

        var triggered = tracker.EvaluateTriggers("BTCUSDT", currentPrice).ToList();

        triggered.Should().HaveCount(shouldTrigger ? 1 : 0);
    }

    [Theory]
    [InlineData(40000, 40000, true)]   // at target
    [InlineData(39000, 40000, true)]   // below target
    [InlineData(41000, 40000, false)]  // above target
    public void TakeProfit_Buy_TriggersWhenPriceAtOrBelowStopPrice(decimal currentPrice, decimal stopPrice, bool shouldTrigger)
    {
        var tracker = new DormantOrderTracker();
        tracker.Register(MakeOrder(OrderSide.Buy, OrderType.TakeProfit, stopPrice));

        var triggered = tracker.EvaluateTriggers("BTCUSDT", currentPrice).ToList();

        triggered.Should().HaveCount(shouldTrigger ? 1 : 0);
    }

    [Theory]
    [InlineData(60000, 60000, true)]   // at target
    [InlineData(61000, 60000, true)]   // above target
    [InlineData(59000, 60000, false)]  // below target
    public void TakeProfit_Sell_TriggersWhenPriceAtOrAboveStopPrice(decimal currentPrice, decimal stopPrice, bool shouldTrigger)
    {
        var tracker = new DormantOrderTracker();
        tracker.Register(MakeOrder(OrderSide.Sell, OrderType.TakeProfit, stopPrice));

        var triggered = tracker.EvaluateTriggers("BTCUSDT", currentPrice).ToList();

        triggered.Should().HaveCount(shouldTrigger ? 1 : 0);
    }

    [Fact]
    public void TriggeredOrder_IsRemovedFromTracker_NotRetriggered()
    {
        var tracker = new DormantOrderTracker();
        tracker.Register(MakeOrder(OrderSide.Sell, OrderType.StopLoss, stopPrice: 45000m));

        tracker.EvaluateTriggers("BTCUSDT", 44000m); // triggers
        var secondEval = tracker.EvaluateTriggers("BTCUSDT", 44000m).ToList(); // should be empty now

        secondEval.Should().BeEmpty();
    }

    [Fact]
    public void OnlyMatchingSymbol_IsTriggered()
    {
        var tracker = new DormantOrderTracker();
        var btcOrder = Order.Create(Guid.NewGuid(), "BTCUSDT", OrderSide.Sell, OrderType.StopLoss, 1m, 50000m, stopPrice: 45000m).Value;
        var ethOrder = Order.Create(Guid.NewGuid(), "ETHUSDT", OrderSide.Sell, OrderType.StopLoss, 1m, 3000m, stopPrice: 2500m).Value;
        tracker.Register(btcOrder);
        tracker.Register(ethOrder);

        var triggered = tracker.EvaluateTriggers("BTCUSDT", 44000m).ToList();

        triggered.Should().ContainSingle().Which.Symbol.Should().Be("BTCUSDT");
    }
}
