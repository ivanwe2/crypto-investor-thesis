using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TradeEngine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTradeOutboxPattern : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "trade_outbox_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Content = table.Column<string>(type: "jsonb", nullable: false),
                    OccurredOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trade_outbox_messages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_trade_outbox_messages_ProcessedOnUtc_OccurredOnUtc",
                table: "trade_outbox_messages",
                columns: new[] { "ProcessedOnUtc", "OccurredOnUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "trade_outbox_messages");
        }
    }
}
