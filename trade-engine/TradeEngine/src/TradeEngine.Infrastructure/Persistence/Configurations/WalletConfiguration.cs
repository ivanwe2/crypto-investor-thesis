using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence.Configurations;

public class WalletConfiguration : IEntityTypeConfiguration<Wallet>
{
    public void Configure(EntityTypeBuilder<Wallet> builder)
    {
        builder.ToTable("wallets");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId)
               .IsRequired();

        builder.Property(x => x.Version)
               .IsRowVersion();

        builder.HasMany(x => x.Balances)
               .WithOne()
               .HasForeignKey("WalletId")
               .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(Wallet.Balances))!
               .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}