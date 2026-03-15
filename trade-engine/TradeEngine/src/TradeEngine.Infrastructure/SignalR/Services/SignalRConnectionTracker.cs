namespace TradeEngine.Infrastructure.SignalR.Services;

public class SignalRConnectionTracker
{
    private int _connectionCount;

    public int CurrentConnections => _connectionCount;

    public void Increment() => Interlocked.Increment(ref _connectionCount);

    public void Decrement() => Interlocked.Decrement(ref _connectionCount);
}