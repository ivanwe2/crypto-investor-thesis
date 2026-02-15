using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Infrastructure.SignalR.Services;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Messaging;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSignalR();

builder.Services.AddSingleton<IPriceBroadcaster, PriceBroadcaster>();

builder.Services.AddHostedService<RabbitMqListener>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactClient", policy =>
    {
        policy.WithOrigins("http://localhost:3000") // The Vite Frontend URL
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ReactClient");

app.MapHub<MarketDataHub>("/hubs/market");

app.MapGet("/", () => "Trade Engine is Running");

app.Run();