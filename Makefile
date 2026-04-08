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

# Runs k6 load tests against the local stack.
# Results are printed to the terminal AND saved to load-tests/results/summary.json.
# --add-host makes host.docker.internal resolve on Linux (OCI) as well as Mac/Windows.
load-test:
	docker run --rm \
		--add-host=host.docker.internal:host-gateway \
		-v "$(CURDIR)/load-tests:/scripts" \
		grafana/k6 run \
		--summary-export=/scripts/summary.json \
		/scripts/trade-engine-load.js

# Runs k6 load tests against the deployed production instance.
# Usage: make load-test-prod API_URL=https://app.yourdomain.com/api
load-test-prod:
	docker run --rm \
		-e TRADE_ENGINE_URL=$(API_URL) \
		-v "$(CURDIR)/load-tests:/scripts" \
		grafana/k6 run \
		--summary-export=/scripts/prod-summary.json \
		/scripts/trade-engine-load.js

# Tears down the system AND removes anonymous volumes (wipes DB and Redis!)
clean:
	docker-compose -f $(COMPOSE_FILE) down -v