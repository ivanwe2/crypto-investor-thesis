using System.Threading.Channels;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.Services.Messaging;

public class MarketEventBus : IMarketEventBus
{
    private readonly Channel<TradeData> _channel;

    public MarketEventBus()
    {
        // Thesis Angle: Bounded Channel with DropOldest backpressure.
        // Drops intermediate ticks to prevent OOM exceptions during extreme volatility.
        var options = new BoundedChannelOptions(1024)
        {
            FullMode = BoundedChannelFullMode.DropOldest
        };
        _channel = Channel.CreateBounded<TradeData>(options);
    }

    public ChannelWriter<TradeData> Writer => _channel.Writer;
    public ChannelReader<TradeData> Reader => _channel.Reader;
}