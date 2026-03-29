using System.Threading.Channels;
using TradeEngine.Application.DTOs.Trade;

namespace TradeEngine.Application.Interfaces;

public interface IMarketEventBus
{
    ChannelWriter<TradeData> Writer { get; }
    ChannelReader<TradeData> Reader { get; }
}