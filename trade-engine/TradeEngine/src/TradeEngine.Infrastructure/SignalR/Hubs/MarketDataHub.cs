using Microsoft.AspNetCore.SignalR;
using TradeEngine.Infrastructure.SignalR.Services;

namespace TradeEngine.Infrastructure.SignalR.Hubs;

public class MarketDataHub(SignalRConnectionTracker tracker) : Hub
{
     public override async Task OnConnectedAsync()
    {
        tracker.Increment();
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        tracker.Decrement();
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinMarketGroup(string symbol)
    {
        // Add the user's connection ID to a group named after the symbol (e.g., "BTCUSDT")
        await Groups.AddToGroupAsync(Context.ConnectionId, symbol.ToUpper());
    }

    public async Task LeaveMarketGroup(string symbol)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, symbol.ToUpper());
    }
}