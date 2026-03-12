using System.Threading.Channels;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Services.Orders;

public class OrderIngressQueue : IOrderIngressQueue
{
    private readonly Channel<Order> _queue;

    public OrderIngressQueue()
    {
        var options = new UnboundedChannelOptions
        {
            SingleReader = true, // Only the Matcher reads from this
            SingleWriter = false // Many API requests can write to this
        };
        _queue = Channel.CreateUnbounded<Order>(options);
    }

    public ChannelWriter<Order> Writer => _queue.Writer;
    public ChannelReader<Order> Reader => _queue.Reader;
}