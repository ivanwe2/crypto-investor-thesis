using System.Threading.Channels;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Application.Interfaces;

public interface IOrderIngressQueue
{
    ChannelWriter<Order> Writer { get; }
    ChannelReader<Order> Reader { get; }
}