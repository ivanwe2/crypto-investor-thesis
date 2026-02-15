using Microsoft.AspNetCore.SignalR;

namespace TradeEngine.Infrastructure.SignalR.Hubs;

public class MarketDataHub : Hub
{
    // Frontend calls this: connection.invoke("JoinMarketGroup", "BTCUSDT")
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