using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence.Configurations;

public class TradeOutboxMessageConfiguration : IEntityTypeConfiguration<TradeOutboxMessage>
{
    public void Configure(EntityTypeBuilder<TradeOutboxMessage> builder)
    {
        builder.ToTable("trade_outbox_messages");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Type)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(m => m.Content)
            .IsRequired()
            .HasColumnType("jsonb");

        builder.Property(m => m.OccurredOnUtc)
            .IsRequired();

        builder.Property(m => m.RetryCount).HasDefaultValue(0);

        builder.HasIndex(m => new { m.ProcessedOnUtc, m.OccurredOnUtc });
    }
}