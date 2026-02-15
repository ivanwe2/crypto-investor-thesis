# Use the official .NET 10 SDK image
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# 1. Copy the Solution file (Using the new .slnx format)
COPY ["TradeEngine.slnx", "./"]

# 2. Copy the Project files
# We copy them to the exact structure the .slnx expects
COPY ["src/TradeEngine.Api/TradeEngine.Api.csproj", "src/TradeEngine.Api/"]
COPY ["src/TradeEngine.Application/TradeEngine.Application.csproj", "src/TradeEngine.Application/"]
COPY ["src/TradeEngine.Domain/TradeEngine.Domain.csproj", "src/TradeEngine.Domain/"]
COPY ["src/TradeEngine.Infrastructure/TradeEngine.Infrastructure.csproj", "src/TradeEngine.Infrastructure/"]

# Note: You renamed 'tests' to 'test', so we match that here
COPY ["test/TradeEngine.UnitTests/TradeEngine.UnitTests.csproj", "test/TradeEngine.UnitTests/"]

# 3. Restore dependencies using the XML solution
RUN dotnet restore "TradeEngine.slnx"

# 4. Copy the rest of the source code
COPY . .

# 5. Build the API
# We switch into the API folder to build
WORKDIR "/app/src/TradeEngine.Api"
RUN dotnet build "TradeEngine.Api.csproj" -c Release -o /app/build

# 6. Publish
FROM build AS publish
RUN dotnet publish "TradeEngine.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# 7. Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TradeEngine.Api.dll"]