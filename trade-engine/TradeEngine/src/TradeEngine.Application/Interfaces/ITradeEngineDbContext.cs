using Microsoft.EntityFrameworkCore;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Application.Interfaces;

public interface ITradeEngineDbContext
{
    DbSet<Order> Orders { get; }
    DbSet<Wallet> Wallets { get; }
    DbSet<User> Users { set; }
    DbSet<TradeOutboxMessage> TradeOutboxMessages { set; }
    
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}