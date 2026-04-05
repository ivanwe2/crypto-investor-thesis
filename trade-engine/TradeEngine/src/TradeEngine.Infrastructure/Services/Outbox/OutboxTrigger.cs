using System.Threading.Channels;

namespace TradeEngine.Infrastructure.Services.Outbox;

/// <summary>
/// Thesis Angle: Event-Driven Outbox Processing
/// Replaces inefficient database polling with an in-memory signaling mechanism.
/// A bounded channel of size 1 with DropOldest ensures we don't build up a backlog of signals;
/// we only care IF there is new data, not HOW MANY times it was triggered.
/// </summary>
public class OutboxTrigger
{
    private readonly Channel<bool> _channel;

    public OutboxTrigger()
    {
        // Bounded to 1 because we only need a single binary signal: "Wake up, there's work!"
        var options = new BoundedChannelOptions(1)
        {
            FullMode = BoundedChannelFullMode.DropOldest
        };
        _channel = Channel.CreateBounded<bool>(options);
    }

    // Called by TradeSettlementWorker when a new outbox message is saved
    public void Trigger()
    {
        _channel.Writer.TryWrite(true);
    }

    // Awaited by the OutboxProcessorWorker
    public async Task WaitForTriggerAsync(CancellationToken cancellationToken)
    {
        await _channel.Reader.ReadAsync(cancellationToken);
    }
}