using TradeEngine.Api.Endpoints;

namespace TradeEngine.Api.Extensions;

public static class EndpointExtensions
{
    public static IEndpointRouteBuilder MapAllEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapAnalysisEndpoints();
        app.MapAuthEndpoints();
        app.MapOrderEndpoints();
        app.MapWalletEndpoints();

        return app;
    }
}