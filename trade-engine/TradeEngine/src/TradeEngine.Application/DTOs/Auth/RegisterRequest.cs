namespace TradeEngine.Application.DTOs.Auth;

public record AuthResponse(string Token, string Username, Guid UserId);