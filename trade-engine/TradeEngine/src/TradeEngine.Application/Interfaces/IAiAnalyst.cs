using TradeEngine.Application.DTOs.Analysis;

namespace TradeEngine.Application.Interfaces;

public interface IAiAnalyst
{
    Task<SentimentResult> AnalyzeTextAsync(string text, CancellationToken cancellationToken = default);
}