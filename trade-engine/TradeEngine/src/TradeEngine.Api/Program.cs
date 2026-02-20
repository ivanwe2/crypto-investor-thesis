using Serilog;
using TradeEngine.Api.Endpoints;
using TradeEngine.Api.Extensions;
using TradeEngine.Infrastructure.Extensions;
using TradeEngine.Infrastructure.SignalR.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddPresentationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddSecurityServices(builder.Configuration);

var app = builder.Build();

app.UseExceptionHandler();

await app.ApplyMigrationsAsync();

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