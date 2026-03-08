using Microsoft.AspNetCore.SignalR;
using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Application.Interfaces;
using TradeEngine.Application.Constants;

namespace TradeEngine.Infrastructure.SignalR.Services;

public class SignalRTradeNotifier(IHubContext<MarketDataHub> hubContext) : ITradeNotifier
{
    public async Task NotifyOrderFilledAsync(Guid userId, string symbol, decimal quantity, decimal price)
    {
        // SignalR automatically maps the JWT 'sub' claim to the User Identifier.
        // This ensures ONLY the user who placed the trade receives the notification!
        await hubContext.Clients.User(userId.ToString())
            .SendAsync(
            SignalRConstants.OrderFilledMethod,
            new { symbol, quantity, price });
    }

    public async Task NotifyAiSignalAsync(string symbol, string signal, double confidence, string reason)
    {
        // Blast it out to all connected React clients! 
        // Whale Alert Feed
        // The backend loop for Option 1 is completely finished! The data is officially flowing from .NET -> Postgres -> RabbitMQ -> Python -> RabbitMQ -> .NET -> SignalR
        await hubContext.Clients.All.SendAsync("ReceiveAiSignal", new 
        { 
            symbol, 
            signal, 
            confidence, 
            reason 
        });
    }
}