namespace TradeEngine.Application.Interfaces;

public interface ICurrentUserService
{
    Guid UserId { get; }
}