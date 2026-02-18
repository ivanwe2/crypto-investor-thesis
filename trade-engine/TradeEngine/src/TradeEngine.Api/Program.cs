using Serilog;
using TradeEngine.Api.Endpoints;
using TradeEngine.Api.Middleware.ExceptionHandling;
using TradeEngine.Application.Constants;
using TradeEngine.Application.Interfaces;
using TradeEngine.Infrastructure.Messaging;
using TradeEngine.Infrastructure.Services;
using TradeEngine.Infrastructure.SignalR.Hubs;
using TradeEngine.Infrastructure.SignalR.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) =>
    configuration.ReadFrom.Configuration(context.Configuration));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

builder.Services.AddSignalR();

builder.Services.AddSingleton<IPriceBroadcaster, PriceBroadcaster>();
builder.Services.AddHttpClient<IAiAnalyst, HttpAiAnalyst>(client =>
{
    string aiUrl = builder.Configuration[MessagingConstants.AiAnalystUrlConfigKey] 
                   ?? MessagingConstants.DefaultAiUrl;
                   
    client.BaseAddress = new Uri(aiUrl);
});

builder.Services.AddHostedService<RabbitMqListener>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactClient", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ReactClient");

app.MapHub<MarketDataHub>("/hubs/market");
app.MapAnalysisEndpoints();

app.MapGet("/", () => "Trade Engine is Running");

app.Run();