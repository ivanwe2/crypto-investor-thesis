# 🏛️ System Architecture

The **Crypto Investor** platform is designed around a microservices architecture, emphasizing separation of concerns, scalability, and resilience. Below is a deep dive into the individual components and their interactions.

## 1. Trade Engine (.NET 10 / C#)
The core of the system is the Trade Engine, implemented using **Clean Architecture** to ensure that business rules are independent of external frameworks.
- **Api Layer:** Exposes REST endpoints, configures Swagger, and manages SignalR hubs for real-time client updates.
- **Application Layer:** Implements CQRS (Command Query Responsibility Segregation) using MediatR. It handles business use cases and defines repository interfaces.
- **Domain Layer:** Contains core entities, value objects, and domain-specific business rules with zero dependencies on other layers.
- **Infrastructure Layer:** Handles data access via Entity Framework Core (PostgreSQL), caching (Redis), messaging (RabbitMQ), and gRPC client implementations.

### Matching Engine Pipeline
The Trade Engine uses `.NET Channels` for high-performance, lock-free concurrency:
1. **OrderMatchingWorker:** A read-heavy background service that continuously reads from the `MarketStateCache` (updated via gRPC) and pushes matched orders into a Channel.
2. **TradeSettlementWorker:** A single-threaded consumer that executes atomic updates on wallets and orders in the database via `ExecuteUpdateAsync()`, ensuring consistency before broadcasting events over SignalR.

## 2. Market Data Ingestor (Go 1.25)
The Ingestor service is built for extreme throughput and low latency.
- Connects to external cryptocurrency exchanges via WebSockets.
- Normalizes incoming order book and tick data.
- Streams real-time market updates directly to the Trade Engine via a high-performance **gRPC Stream**.

## 3. AI Analyst (Python 3 / FastAPI)
Provides advanced market sentiment analysis to assist traders.
- Implements a pre-trained **FinBERT** NLP model.
- Analyzes news headlines and market trends.
- Operates asynchronously: the Trade Engine publishes analysis requests to **RabbitMQ**, and the AI Analyst consumes these messages and replies with sentiment scores.

## 4. Web Client (React 19 / TypeScript)
A robust, responsive frontend application.
- Uses **Zustand** for lightweight global state management (user sessions, auth).
- Uses **TanStack React Query** for server state management, caching, and background synchronization.
- Integrates **@microsoft/signalr** for real-time WebSocket updates, providing a seamless "live" trading experience.

## 5. Observability & Infrastructure
The system is heavily instrumented using **OpenTelemetry**.
- **Metrics:** Scraped by Prometheus.
- **Traces:** Managed by Grafana Tempo for distributed tracing across all microservices.
- **Logs:** Aggregated via Grafana Loki.
- **Dashboards:** Centralized in Grafana to provide immediate insights into system health and trading activity.
