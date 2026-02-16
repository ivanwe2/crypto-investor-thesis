using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using TradeEngine.Application.DTOs.Analysis;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Infrastructure.Services;

public class HttpAiAnalyst(
    HttpClient httpClient, 
    ILogger<HttpAiAnalyst> logger) : IAiAnalyst
{
    private readonly JsonSerializerOptions _options = new() { PropertyNameCaseInsensitive = true };

    public async Task<SentimentResult> AnalyzeTextAsync(string text, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new AnalysisRequest(text);
            
            // PostAsJsonAsync handles serialization automatically
            // We target the new versioned API endpoint "/api/v1/analyze"
            var response = await httpClient.PostAsJsonAsync("/api/v1/analyze", request, cancellationToken);
            
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<SentimentResult>(_options, cancellationToken);

            return result ?? new SentimentResult("Unknown", 0.0, "None");
        }
        catch (HttpRequestException httpEx)
        {
            logger.LogWarning("AI Service is unreachable: {Message}", httpEx.Message);
            return new SentimentResult("Neutral", 0.0, "Fallback");
        }
        catch (Exception ex)
        {
            logger.LogError("Error during AI Analysis: {Message}", ex.Message);
            throw;
        }
    }
}