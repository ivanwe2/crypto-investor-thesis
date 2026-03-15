using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TradeEngine.Domain.Constants;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence.Seeder;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TradeEngineDbContext>();

        await context.Database.MigrateAsync();

        bool adminExists = await context.Users.AnyAsync(u => u.Role == RoleConstants.Admin);

        if (adminExists)
        {
            return;
        }

        string masterPassword = "AdminPassword123!";
        string adminPasswordHash = BCrypt.Net.BCrypt.HashPassword(masterPassword);

        var adminUser = User.Create("Admin", adminPasswordHash, RoleConstants.Admin).Value;

        var adminWallet = new Wallet(adminUser.Id);
        adminWallet.Deposit("USDT", 100_000_000m);
        adminWallet.Deposit("BTC", 500m);

        context.Users.Add(adminUser);
        context.Wallets.Add(adminWallet);

        await context.SaveChangesAsync();

        Console.WriteLine("✅ SECURE BOOTSTRAP: Admin user seeded with Whale Wallet.");
    }
}