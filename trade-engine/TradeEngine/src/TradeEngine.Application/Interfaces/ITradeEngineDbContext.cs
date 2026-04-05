using Microsoft.EntityFrameworkCore;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Application.Interfaces;

public interface ITradeEngineDbContext
{
    DbSet<User> Users { get; set; }
    DbSet<Order> Orders { get; set; }
    DbSet<Wallet> Wallets { get; set; }
    DbSet<AssetBalance> AssetBalances { get; set; }
    DbSet<TradeOutboxMessage> TradeOutboxMessages { get; set; }
    
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}