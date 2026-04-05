using Microsoft.AspNetCore.SignalR;
using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Application.Interfaces;
using TradeEngine.Application.Constants;
using TradeEngine.Domain.Enums;

namespace TradeEngine.Infrastructure.SignalR.Services;

public class SignalRTradeNotifier(IHubContext<MarketDataHub> hubContext) : ITradeNotifier
{
    public async Task NotifyOrderFilledAsync(Guid userId, string symbol, decimal quantity, decimal price, OrderSide side)
    {
        // SignalR automatically maps the JWT 'sub' claim to the User Identifier.
        // This ensures ONLY the user who placed the trade receives the notification!
        await hubContext.Clients.User(userId.ToString())
            .SendAsync(
            SignalRConstants.OrderFilledMethod,
            new { symbol, quantity, price, side = side.ToString() });
    }

    public async Task NotifyAiSignalAsync(string symbol, string signal, double confidence, string reason, string side, string timestamp)
    {
        await hubContext.Clients.All.SendAsync("ReceiveAiSignal", new
        {
            symbol,
            signal,
            confidence,
            reason,
            side,
            timestamp
        });
    }
}