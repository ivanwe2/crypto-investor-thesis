using Microsoft.EntityFrameworkCore;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence;

public class TradeEngineDbContext(DbContextOptions<TradeEngineDbContext> options) : DbContext(options)
{
    public DbSet<Wallet> Wallets { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Order> Orders { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TradeEngineDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}