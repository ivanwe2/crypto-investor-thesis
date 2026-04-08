using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MockQueryable.NSubstitute;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using System.Diagnostics.Metrics;
using System.Threading.Channels;
using TradeEngine.Application.Features.Orders.PlaceOrder;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Enums;

namespace TradeEngine.UnitTests.Handlers;

public class PlaceOrderHandlerTests : IDisposable
{
    private readonly ITradeEngineDbContext _dbContext = Substitute.For<ITradeEngineDbContext>();
    private readonly IOrderIngressQueue _ingressQueue = Substitute.For<IOrderIngressQueue>();
    private readonly IRedisReadModelService _redisService = Substitute.For<IRedisReadModelService>();
    private readonly IMeterFactory _meterFactory = Substitute.For<IMeterFactory>();
    private readonly ILogger<PlaceOrderCommandHandler> _logger = Substitute.For<ILogger<PlaceOrderCommandHandler>>();
    private readonly Meter _meter = new("TradeEngine.Trading");
    private readonly ChannelWriter<Order> _mockWriter = Substitute.For<ChannelWriter<Order>>();

    private PlaceOrderCommandHandler CreateHandler()
    {
        _meterFactory.Create(Arg.Any<MeterOptions>()).Returns(_meter);
        _ingressQueue.Writer.Returns(_mockWriter);
        return new PlaceOrderCommandHandler(_dbContext, _ingressQueue, _redisService, _meterFactory, _logger);
    }

    private static Wallet CreateWalletWithBalance(Guid userId, string currency, decimal amount)
    {
        var wallet = new Wallet(userId);
        wallet.Deposit(currency, amount);
        return wallet;
    }

    private void SetupWallet(Wallet? wallet)
    {
        var walletList = wallet is null ? new List<Wallet>() : new List<Wallet> { wallet };
        // Pre-compute mocks before property access — BuildMockDbSet creates internal NSubstitute
        // mocks that would reset the "last call" tracker if evaluated inside Returns()
        var mockWallets = walletList.AsQueryable().BuildMockDbSet();
        var mockOrders = new List<Order>().AsQueryable().BuildMockDbSet();
        _dbContext.Wallets.Returns(mockWallets);
        _dbContext.Orders.Returns(mockOrders);
    }

    [Fact]
    public async Task Handle_WalletNotFound_ReturnsFailure()
    {
        SetupWallet(null);
        var handler = CreateHandler();
        var command = new PlaceOrderCommand(Guid.NewGuid(), "BTCUSDT", OrderSide.Buy, OrderType.Limit, 0.1m, 50000m);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Wallet.NotFound");
    }

    [Fact]
    public async Task Handle_InsufficientBalance_ReturnsFailure()
    {
        var userId = Guid.NewGuid();
        var wallet = CreateWalletWithBalance(userId, "USDT", 100m); // only 100 USDT
        SetupWallet(wallet);
        var handler = CreateHandler();
        // Buy order requires 0.1 BTC * 50000 = 5000 USDT
        var command = new PlaceOrderCommand(userId, "BTCUSDT", OrderSide.Buy, OrderType.Limit, 0.1m, 50000m);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Wallet.InsufficientFunds");
    }

    [Fact]
    public async Task Handle_ValidBuyOrder_ReturnsSuccess()
    {
        var userId = Guid.NewGuid();
        var wallet = CreateWalletWithBalance(userId, "USDT", 10000m);
        SetupWallet(wallet);
        _dbContext.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns(1);
        var handler = CreateHandler();
        var command = new PlaceOrderCommand(userId, "BTCUSDT", OrderSide.Buy, OrderType.Limit, 0.1m, 50000m);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_ValidSellOrder_WithdrawsBaseAsset()
    {
        var userId = Guid.NewGuid();
        var wallet = CreateWalletWithBalance(userId, "BTC", 1m);
        SetupWallet(wallet);
        _dbContext.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns(1);
        var handler = CreateHandler();
        var command = new PlaceOrderCommand(userId, "BTCUSDT", OrderSide.Sell, OrderType.Market, 0.5m, TargetPrice: 0);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        wallet.Balances.Single(b => b.Currency == "BTC").Amount.Should().Be(0.5m);
    }

    [Fact]
    public async Task Handle_BuyOrderWithZeroTargetPrice_ReturnsInvalidPriceError()
    {
        var userId = Guid.NewGuid();
        var wallet = CreateWalletWithBalance(userId, "USDT", 10000m);
        SetupWallet(wallet);
        var handler = CreateHandler();
        var command = new PlaceOrderCommand(userId, "BTCUSDT", OrderSide.Buy, OrderType.Limit, 0.1m, TargetPrice: 0);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Order.InvalidPrice");
    }

    [Fact]
    public async Task Handle_SaveChangesThrowsConcurrencyException_ExhaustsRetries_ReturnsConcurrencyConflict()
    {
        var userId = Guid.NewGuid();
        // Pre-compute mocks before property access to avoid NSubstitute last-call tracker reset
        var mockWallets1 = new List<Wallet> { CreateWalletWithBalance(userId, "USDT", 999_999m) }.AsQueryable().BuildMockDbSet();
        var mockWallets2 = new List<Wallet> { CreateWalletWithBalance(userId, "USDT", 999_999m) }.AsQueryable().BuildMockDbSet();
        var mockWallets3 = new List<Wallet> { CreateWalletWithBalance(userId, "USDT", 999_999m) }.AsQueryable().BuildMockDbSet();
        var mockOrders = new List<Order>().AsQueryable().BuildMockDbSet();
        _dbContext.Wallets.Returns(mockWallets1, mockWallets2, mockWallets3);
        _dbContext.Orders.Returns(mockOrders);
        _dbContext.SaveChangesAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new DbUpdateConcurrencyException("conflict"));
        var handler = CreateHandler();
        var command = new PlaceOrderCommand(userId, "BTCUSDT", OrderSide.Buy, OrderType.Limit, 0.1m, 50000m);

        var result = await handler.Handle(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Code.Should().Be("Order.ConcurrencyConflict");
    }

    public void Dispose() => _meter.Dispose();
}
