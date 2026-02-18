using Microsoft.EntityFrameworkCore;
using Serilog;
using TradeEngine.Api.Endpoints;
using TradeEngine.Api.Extensions;
using TradeEngine.Api.Middleware.ExceptionHandling;
using TradeEngine.Application.Constants;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Extensions;
using TradeEngine.Infrastructure.Messaging;
using TradeEngine.Infrastructure.Persistence;
using TradeEngine.Infrastructure.Services;
using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Infrastructure.SignalR.Services;

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
app.MapAnalysisEndpoints();

app.MapGet("/", () => "Trade Engine is Running");

app.Run();