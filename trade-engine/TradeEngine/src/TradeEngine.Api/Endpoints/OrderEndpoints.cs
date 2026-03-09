using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.Features.Orders;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/orders")
                       .WithTags("Orders")
                       .RequireAuthorization();

        group.MapPost("/", PlaceOrderAsync).WithName("PlaceOrder");
    }

    private static async Task<Results<Ok<OrderResponse>, BadRequest<string>>> PlaceOrderAsync(
        [FromBody] PlaceOrderRequest request, 
        ISender sender, 
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var command = new PlaceOrderCommand(
            currentUserService.UserId,
            request.Symbol,
            request.Side,
            request.Type,
            request.Quantity,
            request.TargetPrice
        );

        var result = await sender.Send(command, ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }
}