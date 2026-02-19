using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using TradeEngine.Application.Interfaces;

namespace TradeEngine.Api.Services;

public class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    public Guid UserId
    {
        get
        {
            var userIdClaim = httpContextAccessor.HttpContext?.User?.FindFirst(ClaimTypes.NameIdentifier) 
                              ?? httpContextAccessor.HttpContext?.User?.FindFirst("sub");
            
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            {
                return userId;
            }

            throw new UnauthorizedAccessException("User context is missing. Are you logged in?");
        }
    }
}