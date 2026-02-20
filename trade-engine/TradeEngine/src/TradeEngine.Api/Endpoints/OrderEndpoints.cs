using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/orders")
                       .WithTags("Orders")
                       .RequireAuthorization();

        group.MapPost("/", PlaceOrderAsync).WithName("PlaceOrder");
    }

    private static async Task<Results<Ok<OrderResponse>, BadRequest<string>>> PlaceOrderAsync(
        [FromBody] PlaceOrderRequest request, 
        IOrderService orderService, 
        CancellationToken ct)
    {
        var result = await orderService.PlaceOrderAsync(request, ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }
}