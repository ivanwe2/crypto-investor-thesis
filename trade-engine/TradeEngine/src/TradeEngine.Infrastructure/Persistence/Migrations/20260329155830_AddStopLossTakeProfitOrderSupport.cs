using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TradeEngine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStopLossTakeProfitOrderSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "StopPrice",
                table: "orders",
                type: "numeric(18,8)",
                precision: 18,
                scale: 8,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StopPrice",
                table: "orders");
        }
    }
}
