using Asp.Versioning;
using TradeEngine.Api.Endpoints;

namespace TradeEngine.Api.Extensions;

public static class EndpointExtensions
{
    public static IEndpointRouteBuilder MapAllEndpoints(this IEndpointRouteBuilder app)
    {
        var apiVersionSet = app.NewApiVersionSet()
            .HasApiVersion(new ApiVersion(1))
            .ReportApiVersions()
            .Build();

        // 2. Create a versioned route group: /api/v1
        var versionedGroup = app.MapGroup("/api/v{version:apiVersion}")
                                .WithApiVersionSet(apiVersionSet);

        // 3. Map all endpoints UNDER the versioned group
        versionedGroup.MapAnalysisEndpoints();
        versionedGroup.MapAuthEndpoints();
        versionedGroup.MapOrderEndpoints();
        versionedGroup.MapWalletEndpoints();
        versionedGroup.MapMarketEndpoints();

        // 4. Map infrastructure endpoints OUTSIDE the versioned group
        app.MapHealthChecks("/healthz");

        return app;
    }
}