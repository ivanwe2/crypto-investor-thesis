using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence.Configurations;

public class AssetBalanceConfiguration : IEntityTypeConfiguration<AssetBalance>
{
    public void Configure(EntityTypeBuilder<AssetBalance> builder)
    {
        builder.ToTable("asset_balances");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Currency)
               .HasMaxLength(10)
               .IsRequired();

        builder.Property(x => x.Amount)
               .HasPrecision(18, 8);
    }
}
