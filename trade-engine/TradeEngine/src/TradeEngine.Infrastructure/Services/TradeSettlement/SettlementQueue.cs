using System.Threading.Channels;

namespace TradeEngine.Infrastructure.Services.TradeSettlement;

/// <summary>
/// Partitioned settlement queue with <see cref="LaneCount"/> independent channels.
/// Orders are routed to a lane by <c>symbol.GetHashCode() % LaneCount</c>, so all
/// settlements for a given symbol are serialised within one lane while settlements for
/// different symbols proceed in parallel — reducing PostgreSQL write-lock contention.
/// </summary>
public class SettlementQueue
{
    public const int LaneCount = 4;

    private readonly Channel<TradeSettlementCommand>[] _lanes =
        Enumerable.Range(0, LaneCount)
                  .Select(_ => Channel.CreateUnbounded<TradeSettlementCommand>())
                  .ToArray();

    /// <summary>Routes <paramref name="command"/> to the lane for its symbol.</summary>
    public void Write(TradeSettlementCommand command)
    {
        var lane = Math.Abs(command.Symbol.GetHashCode()) % LaneCount;
        _lanes[lane].Writer.TryWrite(command);
    }

    /// <summary>Returns the reader for the given lane index (0 to LaneCount-1).</summary>
    public ChannelReader<TradeSettlementCommand> GetReader(int lane) => _lanes[lane].Reader;
}
