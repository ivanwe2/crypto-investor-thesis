using System.Text.Json.Serialization;

namespace TradeEngine.Application.DTOs.Analysis;
public record SentimentResult(
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("score")] double Score,
    [property: JsonPropertyName("model_version")] string ModelVersion
);