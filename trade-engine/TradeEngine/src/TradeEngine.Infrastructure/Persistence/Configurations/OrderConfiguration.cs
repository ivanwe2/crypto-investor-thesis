using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");

        builder.HasKey(x => x.Id);

        builder.HasIndex(x => x.UserId);

        builder.Property(x => x.Symbol)
               .HasMaxLength(20)
               .IsRequired();

        builder.Property(x => x.Quantity).HasPrecision(18, 8);
        builder.Property(x => x.TargetPrice).HasPrecision(18, 8);
        builder.Property(x => x.ExecutionPrice).HasPrecision(18, 8);
        builder.Property(x => x.StopPrice).HasPrecision(18, 8).IsRequired(false);

        builder.Property(x => x.Side).HasConversion<string>().HasMaxLength(10);
        builder.Property(x => x.Type).HasConversion<string>().HasMaxLength(10);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
    }
}