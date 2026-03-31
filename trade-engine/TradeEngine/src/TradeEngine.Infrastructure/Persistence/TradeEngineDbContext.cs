using Microsoft.EntityFrameworkCore;
using TradeEngine.Application.Interfaces;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence;

public class TradeEngineDbContext(DbContextOptions<TradeEngineDbContext> options) : DbContext(options), ITradeEngineDbContext
{
    public DbSet<Wallet> Wallets { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<TradeOutboxMessage> TradeOutboxMessages { get; set; }
    public DbSet<AssetBalance> AssetBalances { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(TradeEngineDbContext).Assembly);

        base.OnModelCreating(modelBuilder);
    }
}