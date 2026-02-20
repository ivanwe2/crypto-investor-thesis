using Microsoft.AspNetCore.Http.HttpResults;
using TradeEngine.Application.DTOs.Wallet;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Api.Endpoints;

public static class WalletEndpoints
{
    public static void MapWalletEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/wallets")
                       .WithTags("Wallets")
                       .RequireAuthorization();

        group.MapGet("/my-wallet", GetMyWalletAsync).WithName("GetMyWallet");
    }

    private static async Task<Results<Ok<WalletResponse>, BadRequest<string>>> GetMyWalletAsync(
        IWalletService walletService, 
        CancellationToken ct)
    {
        var result = await walletService.GetMyWalletAsync(ct);
        
        return result.IsSuccess 
            ? TypedResults.Ok(result.Value) 
            : TypedResults.BadRequest(result.Error.Name);
    }
}