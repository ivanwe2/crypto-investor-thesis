using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using TradeEngine.Application.DTOs.Auth;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Authentication");

        group.MapPost("/register", RegisterAsync).WithName("Register");
        group.MapPost("/login", LoginAsync).WithName("Login");
    }

    private static async Task<Results<Ok<AuthResponse>, BadRequest<string>>> RegisterAsync(
        [FromBody] RegisterRequest request, 
        IAuthService authService, 
        CancellationToken ct)
    {
        var result = await authService.RegisterAsync(request, ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }

    private static async Task<Results<Ok<AuthResponse>, BadRequest<string>>> LoginAsync(
        [FromBody] LoginRequest request, 
        IAuthService authService, 
        CancellationToken ct)
    {
        var result = await authService.LoginAsync(request, ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }
}