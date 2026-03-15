using Serilog;
using TradeEngine.Api.Endpoints;
using TradeEngine.Api.Extensions;
using TradeEngine.Application.Constants;
using TradeEngine.Infrastructure.Extensions;
using TradeEngine.Infrastructure.Persistence.Seeder;
using TradeEngine.Infrastructure.SignalR.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
{
    configuration.ReadFrom.Configuration(context.Configuration);

    var otlpEndpoint = context.Configuration[ObservabilityConstants.OtlpEndpointConfigKey] 
                       ?? ObservabilityConstants.DefaultOtlpEndpoint;
                       
    var serviceName = context.Configuration[ObservabilityConstants.ServiceNameConfigKey] 
                      ?? ObservabilityConstants.ServiceName;

    configuration.WriteTo.OpenTelemetry(options =>
    {
        options.Endpoint = otlpEndpoint;
        options.Protocol = Serilog.Sinks.OpenTelemetry.OtlpProtocol.Grpc;
        options.ResourceAttributes = new Dictionary<string, object>
        {
            ["service.name"] = serviceName,
        };
    });
});

builder.Services.AddPresentationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddSecurityServices(builder.Configuration);

builder.Services.AddObservabilityServices(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();

await app.ApplyMigrationsAsync();
await DatabaseSeeder.SeedAsync(app.Services);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();
app.UseCors("ReactClient");

app.UseAuthentication();
app.UseAuthorization();

app.MapHub<MarketDataHub>("/hubs/market");
app.MapAllEndpoints();

app.MapGet("/", () => "Trade Engine is Running");

app.Run();