using System.Collections.Concurrent;
using System.Diagnostics.Metrics;

namespace TradeEngine.Infrastructure.SignalR.Services;

public class SignalRConnectionTracker
{
    public static readonly string MeterName = "TradeEngine.SignalR";

    private int _connectionCount;
    private readonly ConcurrentDictionary<string, int> _groupCounts = new();
    private readonly ConcurrentDictionary<string, ConcurrentBag<string>> _connectionGroups = new();

    public SignalRConnectionTracker(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create(MeterName);
        meter.CreateObservableGauge("trade_engine.signalr_connections",
            () => _connectionCount,
            description: "Active SignalR WebSocket connections");
    }

    public int CurrentConnections => _connectionCount;

    public void Increment() => Interlocked.Increment(ref _connectionCount);

    public void Decrement() => Interlocked.Decrement(ref _connectionCount);

    /// <summary>Increments the ref count for a SignalR group. Returns the new count.</summary>
    public int IncrementGroup(string group)
        => _groupCounts.AddOrUpdate(group, 1, (_, count) => count + 1);

    /// <summary>Decrements the ref count for a SignalR group. Returns the new count (clamped to 0).</summary>
    public int DecrementGroup(string group)
        => _groupCounts.AddOrUpdate(group, 0, (_, count) => Math.Max(0, count - 1));

    public int GetGroupCount(string group)
        => _groupCounts.GetValueOrDefault(group, 0);

    /// <summary>Tracks which groups a connection belongs to (for cleanup on disconnect).</summary>
    public void TrackConnectionGroup(string connectionId, string group)
        => _connectionGroups.GetOrAdd(connectionId, _ => []).Add(group);

    /// <summary>
    /// Removes a connection and decrements all its group ref counts.
    /// Returns the groups whose count dropped to zero (candidates for unsubscription).
    /// </summary>
    public IEnumerable<string> RemoveConnection(string connectionId)
    {
        if (!_connectionGroups.TryRemove(connectionId, out var groups))
            return [];

        var zeroed = new List<string>();
        foreach (var group in groups.Distinct())
        {
            var remaining = DecrementGroup(group);
            if (remaining == 0)
                zeroed.Add(group);
        }
        return zeroed;
    }
}
