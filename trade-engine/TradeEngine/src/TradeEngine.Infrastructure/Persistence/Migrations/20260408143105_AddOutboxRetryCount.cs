using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TradeEngine.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutboxRetryCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FailedAt",
                table: "trade_outbox_messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetryCount",
                table: "trade_outbox_messages",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FailedAt",
                table: "trade_outbox_messages");

            migrationBuilder.DropColumn(
                name: "RetryCount",
                table: "trade_outbox_messages");
        }
    }
}
