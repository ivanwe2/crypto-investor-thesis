# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack microservices cryptocurrency trading platform (bachelor's thesis). Five main services communicate via gRPC, RabbitMQ, SignalR, and REST.

| Service | Language | Port | Purpose |
|---------|----------|------|---------|
| `web-client` | TypeScript / React 19 | 3000 | Trading UI |
| `trade-engine` | C# / .NET 10 | 5000/8080 | REST API, matching engine, settlement |
| `ingestor` | Go 1.25 | 50051 | Real-time market data via gRPC |
| `ai-analyst` | Python 3 / FastAPI | 8000 | FinBERT sentiment analysis |
| Infra | Docker Compose | various | PostgreSQL, Redis, RabbitMQ, observability stack |

## Commands

### All Services (Docker Compose)
```bash
make up            # Start all services
make down          # Stop all services
make logs          # Tail all logs
make rebuild       # Rebuild and restart containers
make restart-api   # Restart trade-engine only
make clean         # Remove containers + volumes (wipes DB)
```

### web-client (React + Vite)
```bash
cd web-client
make install       # npm install
make dev           # Vite dev server with HMR
make build         # tsc -b && vite build
make lint          # eslint .
```

### trade-engine (.NET 10)
```bash
cd trade-engine
make build         # dotnet build
make run           # dotnet run
make test          # dotnet test
make migrate name=MigrationName   # Add EF Core migration
make db-update     # Apply pending migrations
```

### ingestor (Go)
```bash
cd ingestor
make build         # go build -o bin/ingestor cmd/server/main.go
make run           # go run cmd/server/main.go
make test          # go test -v ./...
make proto         # Regenerate protobuf code
```

### ai-analyst (Python)
Run via Docker Compose only. No local Makefile — uses uvicorn.

## Architecture

### Trade Engine (.NET) — Clean Architecture
Four projects in `trade-engine/TradeEngine.slnx`:
- **TradeEngine.Api** — Minimal API endpoints (Auth, Orders, Wallets, Markets, Analysis), SignalR hub, Swagger
- **TradeEngine.Application** — MediatR handlers, CQRS-like request/response, service interfaces
- **TradeEngine.Domain** — Entities, value objects, business rules
- **TradeEngine.Infrastructure** — EF Core (Npgsql), Redis, RabbitMQ publisher, gRPC client to ingestor, migrations

### Order Matching Pipeline
The matching engine uses .NET Channels to decouple reading from writing:
1. **OrderMatchingWorker** (read-heavy, lock-free): reads MarketStateCache (populated from Ingestor via gRPC), queries pending orders with `.AsNoTracking()`, pushes matched orders into a Channel
2. **TradeSettlementWorker** (single-threaded, write-safe): consumes from Channel, executes atomic wallet/order updates via `ExecuteUpdateAsync()`, pushes SignalR notifications to clients

### Inter-Service Communication
- **trade-engine → ingestor**: gRPC (real-time market prices / order book state)
- **trade-engine ↔ ai-analyst**: RabbitMQ (analysis requests and results)
- **web-client → trade-engine**: REST + SignalR WebSocket
- **ingestor → exchanges**: External WebSocket (market data feeds)

### Frontend State Management
- **Zustand** — client-side global state (auth, portfolio)
- **TanStack React Query** — server state, caching, background refetching
- **React Hook Form + Zod** — form validation
- **@microsoft/signalr** — real-time trade updates from trade-engine

### Observability Stack (`infra/`)
OpenTelemetry instrumented across all services → collected by OTel Collector → exported to:
- **Prometheus** — metrics
- **Grafana Tempo** — distributed traces
- **Grafana Loki** — logs
- **Grafana** — dashboards

## Key Infrastructure Details

- **Database**: PostgreSQL 17 on `:5432`, database `trading_db`, credentials `admin/password` (dev)
- **Redis**: `:6379` — session cache and MarketStateCache (1-minute expiration)
- **RabbitMQ**: `:5672`, management UI `:15672`
- **JWT**: HS256, validated in trade-engine; `X-API-Key` header auth in ai-analyst
- **EF Core Migrations**: located in `trade-engine/TradeEngine.Infrastructure/Persistence/Migrations/`
