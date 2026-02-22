using Microsoft.AspNetCore.SignalR;
using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.SignalR.Services;

public class SignalRTradeNotifier(IHubContext<MarketDataHub> hubContext) : ITradeNotifier
{
    public async Task NotifyOrderFilledAsync(Guid userId, string symbol, decimal quantity, decimal price)
    {
        // SignalR automatically maps the JWT 'sub' claim to the User Identifier.
        // This ensures ONLY the user who placed the trade receives the notification!
        await hubContext.Clients.User(userId.ToString())
            .SendAsync("OrderFilled", new { Symbol = symbol, Quantity = quantity, Price = price });
    }
}