using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TradeEngine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderStatusSymbolIndices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_orders_Status",
                table: "orders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_orders_Symbol_Status",
                table: "orders",
                columns: new[] { "Symbol", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_orders_Status",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_Symbol_Status",
                table: "orders");
        }
    }
}
