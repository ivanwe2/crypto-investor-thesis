using MediatR;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TradeEngine.Application.Constants;
using TradeEngine.Application.DTOs.Order;
using TradeEngine.Application.DTOs.Trade;
using TradeEngine.Application.Features.Orders.CancelOrder;
using TradeEngine.Application.Features.Orders.GetHistory;
using TradeEngine.Application.Features.Orders.GetOpenOrders;
using TradeEngine.Application.Features.Orders.PlaceOrder;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Telemetry;

namespace TradeEngine.Api.Endpoints;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/orders")
                       .WithTags("Orders")
                       .RequireAuthorization()
                       .RequireRateLimiting(PolicyConstants.OrderPlacement);;

        group.MapPost("/", PlaceOrderAsync).WithName("PlaceOrder");
        group.MapGet("/open", GetOpenOrdersAsync).WithName("GetOpenOrders");
        group.MapGet("/history", GetTradeHistoryAsync).WithName("GetTradeHistory");
        group.MapDelete("/{id:guid}", CancelOrderAsync).WithName("CancelOrder");
    }

    private static async Task<Results<Ok<List<TradeHistoryDto>>, BadRequest<string>>> GetTradeHistoryAsync(
        [FromQuery] int? limit,
        ISender sender, 
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var query = new GetTradeHistoryQuery(currentUserService.UserId, limit ?? 50);
        var result = await sender.Send(query, ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }
    
    private static async Task<Results<Ok<OrderResponse>, BadRequest<string>>> PlaceOrderAsync(
        [FromBody] PlaceOrderRequest request,
        ISender sender,
        ICurrentUserService currentUserService,
        TradingMetrics tradingMetrics,
        CancellationToken ct)
    {
        var command = new PlaceOrderCommand(
            currentUserService.UserId,
            request.Symbol,
            request.Side,
            request.Type,
            request.Quantity,
            request.TargetPrice,
            request.StopPrice
        );

        var result = await sender.Send(command, ct);

        if (result.IsSuccess)
        {
            tradingMetrics.RecordOrderPlaced(request.Type.ToString(), request.Side.ToString());
            return TypedResults.Ok(result.Value);
        }

        return TypedResults.BadRequest(result.Error.Name);
    }
    private static async Task<Results<Ok<List<OpenOrderDto>>, BadRequest<string>>> GetOpenOrdersAsync(
        ISender sender, 
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var query = new GetOpenOrdersQuery(currentUserService.UserId);
        var result = await sender.Send(query, ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }

    private static async Task<Results<NoContent, BadRequest<string>>> CancelOrderAsync(
        [FromRoute] Guid id,
        ISender sender,
        ICurrentUserService currentUserService,
        CancellationToken ct)
    {
        var command = new CancelOrderCommand(id, currentUserService.UserId);
        var result = await sender.Send(command, ct);

        return result.IsSuccess 
            ? TypedResults.NoContent() 
            : TypedResults.BadRequest(result.Error.Name);
    }
}