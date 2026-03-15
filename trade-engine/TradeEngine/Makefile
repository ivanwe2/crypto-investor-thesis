PROJECT = TradeEngine.Api/TradeEngine.Api.csproj
INFRA_PROJECT = TradeEngine.Infrastructure/TradeEngine.Infrastructure.csproj
STARTUP_PROJECT = TradeEngine.Api/TradeEngine.Api.csproj
MIGRATIONS_DIR = Persistence/Migrations
APP_NAME = trade-engine

.PHONY: all build run test clean migrate db-update docker

# Default target
all: build

# Restores dependencies and compiles the code
build:
	dotnet build

# Runs the API project
run:
	dotnet run --project $(PROJECT)

# Generates a new EF Core Migration. Usage: make migrate name=AddedRole
migrate:
	dotnet ef migrations add $(name) --project $(INFRA_PROJECT) --startup-project $(STARTUP_PROJECT) --output-dir $(MIGRATIONS_DIR)

# Applies pending migrations to the database
db-update:
	dotnet ef database update --project $(INFRA_PROJECT) --startup-project $(STARTUP_PROJECT)

# Runs all unit and integration tests
test:
	dotnet test

# Cleans the build output (bin and obj folders)
clean:
	dotnet clean
	rm -rf TradeEngine.Api/bin TradeEngine.Api/obj
	rm -rf TradeEngine.Infrastructure/bin TradeEngine.Infrastructure/obj

# Builds the Docker container for the .NET service
docker:
	docker build -t $(APP_NAME):latest -f TradeEngine.Api/Dockerfile .