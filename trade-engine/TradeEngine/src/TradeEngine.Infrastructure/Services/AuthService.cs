using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using TradeEngine.Application.DTOs.Auth;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;
using TradeEngine.Domain.Shared;
using TradeEngine.Infrastructure.Persistence;
using JwtConstants = TradeEngine.Application.Constants.JwtConstants;

namespace TradeEngine.Infrastructure.Services;

public class AuthService(TradeEngineDbContext dbContext, IConfiguration configuration) : IAuthService
{
    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        bool userExists = await dbContext.Users.AnyAsync(u => u.Username == request.Username, cancellationToken);
        if (userExists)
        {
            return Result<AuthResponse>.Failure<AuthResponse>(new Error("Auth.UsernameTaken", "Username is already taken"));
        }

        string passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        
        var userResult = User.Create(request.Username, passwordHash);
        if (userResult.IsFailure)
            return Result<AuthResponse>.Failure<AuthResponse>(userResult.Error);

        var user = userResult.Value;

        var wallet = new Wallet(user.Id);
        wallet.Deposit("USDT", 10000m);

        dbContext.Users.Add(user);
        dbContext.Wallets.Add(wallet);
        
        await dbContext.SaveChangesAsync(cancellationToken);

        string token = GenerateJwtToken(user);
        return new AuthResponse(token, user.Username, user.Id);
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await dbContext.Users.SingleOrDefaultAsync(u => u.Username == request.Username, cancellationToken);
        
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Result<AuthResponse>.Failure<AuthResponse>(new Error("Auth.InvalidCredentials", "Invalid username or password"));
        }

        string token = GenerateJwtToken(user);
        return new AuthResponse(token, user.Username, user.Id);
    }

    private string GenerateJwtToken(User user)
    {
        var secret = configuration[JwtConstants.ConfigKey] ?? JwtConstants.DefaultSecret;
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), 
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: JwtConstants.Issuer,
            audience: JwtConstants.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(4),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}