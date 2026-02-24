using Microsoft.AspNetCore.SignalR;
using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Application.Constants;
using TradeEngine.Application.Interfaces;
using TradeEngine.Application.DTOs.Trade;

namespace TradeEngine.Infrastructure.SignalR.Services;

public class SignalRPriceBroadcaster(IHubContext<MarketDataHub> hubContext) : IPriceBroadcaster
{
    public async Task BroadcastPriceAsync(TradeData tradeData)
    {
        await hubContext.Clients.Group(tradeData.Symbol.ToUpper())
            .SendAsync(SignalRConstants.ReceivePriceUpdateMethod, tradeData);
    }
}