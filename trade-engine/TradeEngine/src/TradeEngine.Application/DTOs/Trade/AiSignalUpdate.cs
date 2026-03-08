namespace TradeEngine.Application.DTOs.Trade;

public record AiSignalUpdate(
    string Symbol,
    string Signal,
    double Confidence,
    string Reason,
    string Timestamp
);