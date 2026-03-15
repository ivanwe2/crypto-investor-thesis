# Variables
COMPOSE_FILE = docker-compose.yml

.PHONY: all up down logs rebuild restart-api clean

# Default target
all: up

# Starts the whole distributed system in the background
up:
	docker-compose -f $(COMPOSE_FILE) up -d

# Tears down the system and removes the containers
down:
	docker-compose -f $(COMPOSE_FILE) down

# Tails the logs for all services (press Ctrl+C to exit)
logs:
	docker-compose -f $(COMPOSE_FILE) logs -f

# Completely rebuilds the containers (useful after installing new packages)
rebuild:
	docker-compose -f $(COMPOSE_FILE) up -d --build

# Restarts just the .NET engine (useful for quick backend testing)
restart-api:
	docker-compose restart trade-engine

# Tears down the system AND removes anonymous volumes (wipes DB and Redis!)
clean:
	docker-compose -f $(COMPOSE_FILE) down -v