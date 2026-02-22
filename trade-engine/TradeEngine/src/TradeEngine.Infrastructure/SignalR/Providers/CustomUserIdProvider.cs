using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.JsonWebTokens;

namespace TradeEngine.Infrastructure.SignalR.Providers;

public class CustomUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        var userId = connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                  ?? connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return userId;
    }
}