# Crypto Investor Thesis - AI Assistant Guide (Gemini CLI)

## Project Overview
This is a full-stack microservices cryptocurrency trading platform built for a bachelor's thesis. It consists of five main services communicating via REST, gRPC, RabbitMQ, and SignalR.

### Services & Tech Stack
| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| **`web-client`** | TypeScript / React 19 / Vite | 3000 | Trading UI, Zustand (state), React Query, SignalR |
| **`trade-engine`** | C# / .NET 10 | 5000/8080 | REST API, matching engine, settlement, EF Core, Clean Architecture |
| **`ingestor`** | Go 1.25 | 50051 | Real-time market data ingestion via gRPC |
| **`ai-analyst`** | Python 3 / FastAPI | 8000 | FinBERT sentiment analysis |
| **Infra** | Docker Compose | Various| PostgreSQL 17, Redis, RabbitMQ, OTel, Prometheus, Tempo, Loki, Grafana |

## Architecture
- **Clean Architecture (`trade-engine`)**: Divided into `Api`, `Application` (MediatR/CQRS), `Domain`, and `Infrastructure` (EF Core, Redis, RabbitMQ).
- **Matching Engine**: Uses .NET Channels. `OrderMatchingWorker` reads state lock-free, and `TradeSettlementWorker` executes atomic database updates.
- **Inter-Service Communication**:
  - `trade-engine` → `ingestor`: gRPC (real-time data)
  - `trade-engine` ↔ `ai-analyst`: RabbitMQ (analysis tasks)
  - `web-client` ↔ `trade-engine`: REST APIs & SignalR WebSockets
  - `ingestor` → external exchanges: WebSockets
- **Observability**: OpenTelemetry instrumented across all services, collected by OTel Collector, visualized in Grafana (Metrics via Prometheus, Traces via Tempo, Logs via Loki).

## Clean Code Rules & Standards
When contributing to this repository, adhere strictly to the following principles:

### General Principles
- **SOLID**: Follow Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles across all services.
- **DRY (Don't Repeat Yourself)**: Extract reusable logic into shared utilities, base classes, or hooks. Avoid duplicated code blocks.
- **KISS & YAGNI**: Keep it simple and do not over-engineer solutions or add features "just in case".
- **Meaningful Naming**: Use clear, descriptive names for variables, functions, classes, and files. Avoid abbreviations unless universally understood.

### Frontend (`web-client`)
- **ES2026 / Modern TypeScript**: Use modern language features. Enforce strict typing, avoid `any`.
- **Component Architecture**: Keep React components small, focused, and pure where possible. Separate UI from business logic using custom hooks.
- **State Management**: Use `Zustand` for global state and `React Query` for server state/caching.
- **Styling**: Adhere to established styling conventions (Vanilla CSS preferred, unless overriding requested). Ensure responsive and accessible design.

### Backend (`trade-engine`, `ingestor`, `ai-analyst`)
- **Clean Architecture (C#)**: Maintain strict boundaries. Domain must have no external dependencies.
- **Concurrency**: Handle concurrency safely. In .NET, utilize Channels for lock-free processing where applicable.
- **Error Handling**: Implement global exception handling. Do not leak stack traces to the client.
- **Logging**: Use structured logging (Serilog/OTel) with appropriate log levels. Include contextual properties.

## Commands
- **Docker Compose**: `make up`, `make down`, `make logs`, `make rebuild`, `make clean`
- **Frontend**: `cd web-client && make dev`
- **Backend (.NET)**: `cd trade-engine && make run`, `make test`, `make db-update`
- **Ingestor (Go)**: `cd ingestor && make run`, `make test`, `make proto`

## Active Tasks
Use this section to track ongoing work. Update the status as tasks progress.

- [x] Task 1: Initialize GEMINI.md and establish context.
- [ ] Task 2: ...
- [ ] Task 3: ...

---
*Note: This file is the primary source of truth for the Gemini CLI agent. Please update it as the project evolves.*