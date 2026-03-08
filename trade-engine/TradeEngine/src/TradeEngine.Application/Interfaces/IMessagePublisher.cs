namespace TradeEngine.Application.Interfaces;

public interface IMessagePublisher
{
    Task PublishAsync(string eventType, string payload, CancellationToken cancellationToken = default);
}