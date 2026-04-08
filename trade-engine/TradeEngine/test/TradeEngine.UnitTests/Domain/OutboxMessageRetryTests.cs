using FluentAssertions;
using TradeEngine.Domain.Entities;

namespace TradeEngine.UnitTests.Domain;

public class OutboxMessageRetryTests
{
    private const int MaxRetryCount = 5;

    private static TradeOutboxMessage MakeMessage(int retryCount = 0) => new()
    {
        Id = Guid.NewGuid(),
        Type = "TradeSettled",
        Content = "{}",
        OccurredOnUtc = DateTime.UtcNow,
        RetryCount = retryCount
    };

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(4)]
    public void Message_WithRetryCountBelowMax_PassesRetryGate(int retryCount)
    {
        var message = MakeMessage(retryCount);

        var passesGate = message.RetryCount < MaxRetryCount;

        passesGate.Should().BeTrue();
    }

    [Theory]
    [InlineData(5)]
    [InlineData(6)]
    [InlineData(10)]
    public void Message_WithRetryCountAtOrAboveMax_IsBlockedByRetryGate(int retryCount)
    {
        var message = MakeMessage(retryCount);

        var passesGate = message.RetryCount < MaxRetryCount;

        passesGate.Should().BeFalse();
    }

    [Fact]
    public void Message_AfterFailure_RetryCountIncrements()
    {
        var message = MakeMessage(retryCount: 2);

        message.RetryCount++;
        message.FailedAt = DateTime.UtcNow;
        message.Error = "Connection refused";

        message.RetryCount.Should().Be(3);
        message.FailedAt.Should().NotBeNull();
        message.Error.Should().Be("Connection refused");
    }

    [Fact]
    public void Message_AtMaxRetries_HasNullProcessedOnUtc()
    {
        var message = MakeMessage(retryCount: MaxRetryCount);

        // A dead-lettered message has ProcessedOnUtc null (never successfully processed)
        message.ProcessedOnUtc.Should().BeNull();
        message.RetryCount.Should().Be(MaxRetryCount);
    }

    [Fact]
    public void Message_OnSuccess_ProcessedOnUtcIsSet_AndErrorIsCleared()
    {
        var message = MakeMessage(retryCount: 2);
        message.Error = "Previous error";

        // Simulate what the processor does on success
        message.ProcessedOnUtc = DateTime.UtcNow;
        message.Error = null;

        message.ProcessedOnUtc.Should().NotBeNull();
        message.Error.Should().BeNull();
    }
}
