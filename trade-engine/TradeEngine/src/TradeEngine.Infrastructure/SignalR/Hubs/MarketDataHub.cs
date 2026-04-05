using Marketgateway.V1;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using TradeEngine.Infrastructure.SignalR.Services;

namespace TradeEngine.Infrastructure.SignalR.Hubs;

public class MarketDataHub(
    SignalRConnectionTracker tracker,
    MarketDataService.MarketDataServiceClient grpcClient,
    ILogger<MarketDataHub> logger) : Hub
{
    public override async Task OnConnectedAsync()
    {
        tracker.Increment();
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        tracker.Decrement();

        // Clean up all group memberships for this connection and unsubscribe zeroed-out groups
        var zeroedGroups = tracker.RemoveConnection(Context.ConnectionId);
        foreach (var group in zeroedGroups)
        {
            await TryUnsubscribeAsync(group);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinMarketGroup(string symbol)
    {
        var normalizedSymbol = symbol.ToUpper();
        await Groups.AddToGroupAsync(Context.ConnectionId, normalizedSymbol);
        tracker.IncrementGroup(normalizedSymbol);
        tracker.TrackConnectionGroup(Context.ConnectionId, normalizedSymbol);
    }

    public async Task LeaveMarketGroup(string symbol)
    {
        var normalizedSymbol = symbol.ToUpper();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, normalizedSymbol);
        var remaining = tracker.DecrementGroup(normalizedSymbol);

        if (remaining == 0)
        {
            await TryUnsubscribeAsync(normalizedSymbol);
        }
    }

    private async Task TryUnsubscribeAsync(string symbol)
    {
        try
        {
            await grpcClient.UnsubscribeSymbolAsync(new UnsubscribeRequest { Symbol = symbol });
            logger.LogInformation("Unsubscribed from {Symbol} — no remaining listeners", symbol);
        }
        catch (Exception ex)
        {
            // Log but don't fail — ingestor keeps streaming, which is benign
            logger.LogWarning(ex, "Failed to unsubscribe {Symbol} from ingestor", symbol);
        }
    }
}
