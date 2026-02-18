using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TradeEngine.Infrastructure.Persistence;

namespace TradeEngine.Infrastructure.Extensions;

public static class MigrationExtensions
{
    public static async Task ApplyMigrationsAsync(this IHost app)
    {
        using var scope = app.Services.CreateScope();
        var services = scope.ServiceProvider;
        var logger = services.GetRequiredService<ILogger<TradeEngineDbContext>>();

        try
        {
            var context = services.GetRequiredService<TradeEngineDbContext>();

            await context.Database.MigrateAsync();

            logger.LogInformation("Database migration applied successfully.");
        }
        catch (Exception ex)
        {
            logger.LogCritical(ex, "An error occurred while migrating the database.");
            throw;
        }
    }
}
