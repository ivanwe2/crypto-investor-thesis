namespace TradeEngine.Domain.Entities;

public class User
{
    public Guid Id { get; private set; }
    public string Username { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; }

    private User() { }

    public static Result<User> Create(string username, string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(username))
            return Result<User>.Failure<User>(new Error("User.Invalid", "Username cannot be empty"));

        if (string.IsNullOrWhiteSpace(passwordHash))
            return Result<User>.Failure<User>(new Error("User.Invalid", "Password hash cannot be empty"));

        return new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            PasswordHash = passwordHash,
            CreatedAt = DateTime.UtcNow
        };
    }
}