using Marketgateway.V1;

namespace TradeEngine.Api.Endpoints
{
    public static class MarketEndpoints
    {
        public static void MapMarketEndpoints(this IEndpointRouteBuilder app)
        {
            var group = app.MapGroup("/markets").WithTags("Market Data");

            // 1. Fetch Candlestick Data (HTTP GET -> gRPC -> Go)
            group.MapGet("/{symbol}/klines", async (
                string symbol,
                string? interval,
                int? limit,
                MarketDataService.MarketDataServiceClient grpcClient) =>
            {
                var request = new KlinesRequest
                {
                    Symbol = symbol,
                    Interval = string.IsNullOrEmpty(interval) ? "1m" : interval,
                    Limit = limit ?? 50
                };

                // Execute gRPC call to Go Service
                var response = await grpcClient.GetHistoricalKlinesAsync(request);

                return Results.Ok(response);
            })
            .Produces<KlinesResponse>()
            .WithName("GetHistoricalKlines")
            .WithSummary("Fetches OHLCV candlestick data from the Go Market Gateway");

            // 2. Fetch Order Book Depth (HTTP GET -> gRPC -> Go)
            group.MapGet("/{symbol}/orderbook", async (
                string symbol,
                int? limit,
                MarketDataService.MarketDataServiceClient grpcClient) =>
            {
                var request = new OrderBookRequest
                {
                    Symbol = symbol,
                    Limit = limit ?? 15
                };

                // Execute gRPC call to Go Service
                var response = await grpcClient.GetOrderBookDepthAsync(request);

                return Results.Ok(response);
            })
            .Produces<OrderBookResponse>()
            .WithName("GetOrderBookDepth")
            .WithSummary("Fetches L2 Order Book depth from the Go Market Gateway");

            group.MapPost("/{symbol}/track", async (
                string symbol,
                MarketDataService.MarketDataServiceClient grpcClient) =>
            {
                var request = new SubscribeRequest { Symbol = symbol.ToUpper() };
                var response = await grpcClient.SubscribeSymbolAsync(request);
                
                return Results.Ok(new { response.Success, response.Message });
            })
            .WithName("TrackMarket")
            .WithSummary("Dynamically commands the Go Gateway to open a live Binance WebSocket stream for the symbol.");
        }
    }
}