namespace TradeEngine.Infrastructure.Services.TradeSettlement;

public record TradeSettlementCommand(Guid OrderId, decimal ExecutionPrice, string Symbol);