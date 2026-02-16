using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TradeEngine.Application.DTOs.Analysis;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Api.Endpoints;

public static class AnalysisEndpoints
{
    public static void MapAnalysisEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/analysis")
                       .WithTags("AI Analysis");

        group.MapPost("/", AnalyzeText)
             .WithName("AnalyzeSentiment");
    }

    private static async Task<Results<Ok<SentimentResult>, BadRequest<string>>> AnalyzeText(
        [FromBody] AnalysisRequest request, 
        IAiAnalyst aiAnalyst, 
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Text))
        {
            return TypedResults.BadRequest("Text cannot be empty");
        }

        var result = await aiAnalyst.AnalyzeTextAsync(request.Text, ct);
        return TypedResults.Ok(result);
    }
}