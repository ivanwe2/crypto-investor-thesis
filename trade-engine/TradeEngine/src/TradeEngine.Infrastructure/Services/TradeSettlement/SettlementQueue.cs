using System.Threading.Channels;

namespace TradeEngine.Infrastructure.Services.TradeSettlement;

public class SettlementQueue
{
    // Unbounded channel allows the Matcher to queue 100,000 orders instantly without blocking
    private readonly Channel<TradeSettlementCommand> _channel = Channel.CreateUnbounded<TradeSettlementCommand>();
    
    public ChannelWriter<TradeSettlementCommand> Writer => _channel.Writer;
    public ChannelReader<TradeSettlementCommand> Reader => _channel.Reader;
}