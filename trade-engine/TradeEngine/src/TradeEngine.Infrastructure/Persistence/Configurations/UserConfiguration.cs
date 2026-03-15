using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TradeEngine.Domain.Entities;

namespace TradeEngine.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Username)
               .HasMaxLength(50)
               .IsRequired();

        builder.HasIndex(x => x.Username)
               .IsUnique();

        builder.Property(x => x.PasswordHash)
               .HasMaxLength(256)
               .IsRequired();

       builder.Property(x => x.Role)
               .HasMaxLength(20)
               .IsRequired()
               .HasDefaultValue("User");

        builder.Property(x => x.CreatedAt)
               .IsRequired();
    }
}