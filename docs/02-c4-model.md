# C4 Architecture Model

This document provides a visual representation of the Crypto Investor platform using the C4 model and Mermaid.js, covering all four levels: Context, Container, Component, and key Code-level patterns.

---

## 1. System Context Diagram

High-level overview of actors and external systems.

```mermaid
C4Context
    title System Context — Crypto Investor Platform

    Person(user, "Trader / Investor", "Views real-time market data, places orders, and monitors AI sentiment signals.")

    System(platform, "Crypto Investor Platform", "Microservices trading platform: REST API, live order matching, AI sentiment analysis, and full observability.")

    System_Ext(exchanges, "External Crypto Exchanges", "Provides real-time market data (order books, OHLCV) via WebSocket. Primary source: Binance.")
    System_Ext(cloudflare, "Cloudflare (Zero Trust)", "Reverse proxy / tunnel. Terminates TLS, protects internal services from public exposure.")

    Rel(user, platform, "Views data, places orders, receives real-time trade notifications", "HTTPS / WSS")
    Rel(platform, exchanges, "Ingests live market data", "WSS")
    Rel(cloudflare, platform, "Routes public traffic to internal services", "Tunnel")
    Rel(user, cloudflare, "All traffic enters via", "HTTPS")
```

---

## 2. Container Diagram

Zooms into the platform to show each runnable unit and data store.

```mermaid
C4Container
    title Container Diagram — Crypto Investor Platform

    Person(user, "Trader / Investor")

    System_Boundary(platform, "Crypto Investor Platform") {

        Container(web_app, "Web Client", "React 19, TypeScript, Vite", "SPA: trading charts, order book, portfolio, AI signal feed. State: Zustand + React Query.")

        Container(trade_engine, "Trade Engine", "C# .NET 10, ASP.NET Core", "REST API, order matching engine, trade settlement, SignalR hub. Exposes gRPC server on :8080.")

        Container(ingestor, "Market Data Ingestor", "Go 1.25, gRPC server", "Connects to exchange WebSocket feeds, normalises OHLCV and order book data, streams it to Trade Engine via gRPC.")

        Container(ai_analyst, "AI Analyst", "Python 3.11, FastAPI", "Runs FinBERT NLP model. Consumes analysis tasks from RabbitMQ, returns sentiment scores.")

        ContainerDb(db, "PostgreSQL 17", "Relational DB", "Users, wallets, orders, and transactional outbox messages.")
        ContainerDb(cache, "Redis 7", "In-Memory Cache", "MarketStateCache (1 min TTL), session data, live order book snapshots.")
        ContainerDb(broker, "RabbitMQ 3.13", "Message Broker", "Async bridge between Trade Engine and AI Analyst. Also carries outbox event fanout.")

        Container(otel_collector, "OTel Collector", "OpenTelemetry Collector", "Receives traces, metrics, and logs from all services. Exports to Tempo, Prometheus, and Loki.")
        ContainerDb(prometheus, "Prometheus", "Metrics Store", "Scrapes and stores time-series metrics.")
        ContainerDb(loki, "Grafana Loki", "Log Aggregator", "Stores structured logs from all services.")
        ContainerDb(tempo, "Grafana Tempo", "Trace Backend", "Stores distributed traces for cross-service request flow analysis.")
        Container(grafana, "Grafana", "Dashboards", "Unified observability UI: trading overview and infrastructure health dashboards.")
    }

    System_Ext(exchanges, "External Crypto Exchanges", "Binance WebSocket feed.")

    Rel(user, web_app, "Uses", "HTTPS / WSS")
    Rel(web_app, trade_engine, "REST API calls + SignalR real-time updates", "HTTPS / WSS")

    Rel(trade_engine, db, "Reads / writes orders, wallets, outbox", "EF Core / TCP")
    Rel(trade_engine, cache, "Reads market state, writes session cache", "TCP")
    Rel(trade_engine, broker, "Publishes analysis requests + outbox events", "AMQP")
    Rel(trade_engine, ingestor, "Streams market prices and order book state", "gRPC")

    Rel(ai_analyst, broker, "Consumes tasks, publishes sentiment results", "AMQP")

    Rel(ingestor, exchanges, "Subscribes to live data feeds", "WSS")
    Rel(ingestor, cache, "Writes live market state snapshots", "TCP")

    Rel(trade_engine, otel_collector, "Exports traces, metrics, logs", "OTLP/gRPC")
    Rel(ingestor, otel_collector, "Exports traces, metrics, logs", "OTLP/gRPC")
    Rel(ai_analyst, otel_collector, "Exports traces, metrics, logs", "OTLP/gRPC")
    Rel(otel_collector, prometheus, "Exports metrics", "HTTP")
    Rel(otel_collector, loki, "Exports logs", "HTTP")
    Rel(otel_collector, tempo, "Exports traces", "OTLP/gRPC")
    Rel(grafana, prometheus, "Queries metrics", "HTTP")
    Rel(grafana, loki, "Queries logs", "HTTP")
    Rel(grafana, tempo, "Queries traces", "HTTP")
```

---

## 3. Component Diagram — Trade Engine

Zooms into the Trade Engine to show its Clean Architecture layers and the Channel-based matching pipeline.

```mermaid
C4Component
    title Component Diagram — Trade Engine (.NET 10)

    Person(user, "Trader / Investor")
    System_Ext(ingestor, "Market Data Ingestor (Go)")
    ContainerDb(db, "PostgreSQL 17")
    ContainerDb(cache, "Redis")
    ContainerDb(broker, "RabbitMQ")
    Container(signalr_client, "Web Client (SignalR)", "React")

    Container_Boundary(api_layer, "TradeEngine.Api") {
        Component(endpoints, "Minimal API Endpoints", "ASP.NET Core", "Auth, Orders, Wallets, Markets, Analysis, System Health. Versioned under /api/v1.")
        Component(signalr_hub, "TradeHub (SignalR)", "ASP.NET Core SignalR", "Pushes OrderFilled and PriceUpdate events to specific connected clients using JWT-derived user IDs.")
        Component(middleware, "Global Exception Handler", "ASP.NET Core Middleware", "Catches unhandled exceptions, maps domain errors to HTTP status codes.")
    }

    Container_Boundary(app_layer, "TradeEngine.Application") {
        Component(mediatr, "MediatR Handlers", "MediatR", "PlaceOrderCommand, CancelOrderCommand, GetOpenOrdersQuery, GetTradeHistoryQuery, GetPortfolioQuery.")
        Component(interfaces, "Service Interfaces", "C# Interfaces", "IAuthService, IMarketStateCache, ITradeNotifier, IMessagePublisher, IOrderIngressQueue.")
    }

    Container_Boundary(domain_layer, "TradeEngine.Domain") {
        Component(entities, "Entities", "C# Classes", "User, Wallet, AssetBalance, Order, TradeOutboxMessage. All mutations via encapsulated methods.")
        Component(value_objects, "Value Objects & Errors", "C# Records", "Result<T>, Error, Money. Enforces fail-fast error handling without exceptions.")
    }

    Container_Boundary(infra_layer, "TradeEngine.Infrastructure") {
        Component(order_matcher, "OrderMatchingWorker", "BackgroundService", "Read-heavy, lock-free. Reads MarketStateCache from Redis, queries Pending orders with AsNoTracking(), pushes matched pairs into a .NET Channel.")
        Component(settlement, "TradeSettlementWorker", "BackgroundService", "Single-threaded, write-safe. Consumes from Channel. Executes atomic wallet updates via ExecuteUpdateAsync(). Publishes TradeOutboxMessage.")
        Component(outbox, "OutboxProcessorWorker", "BackgroundService", "Polls TradeOutboxMessage table. Forwards unprocessed events to RabbitMQ. Guarantees at-least-once delivery.")
        Component(rmq_consumer, "RabbitMqConsumer", "BackgroundService", "Consumes AI sentiment results from RabbitMQ, broadcasts them via SignalR.")
        Component(ef_core, "TradeEngineDbContext", "EF Core / Npgsql", "Manages all database access. Connection pool size: 1024.")
        Component(grpc_client, "gRPC Client", "Grpc.Net.Client", "Calls Ingestor to fetch klines, order book depth, and subscribe to symbols.")
        Component(redis_service, "RedisReadModelService", "StackExchange.Redis", "Reads and writes market state snapshots with 1-minute TTL.")
        Component(rabbitmq_pub, "RabbitMqPublisher", "RabbitMQ.Client", "Publishes analysis requests and sentiment tasks.")
    }

    Rel(user, endpoints, "HTTP requests", "REST")
    Rel(endpoints, mediatr, "Dispatches commands/queries", "In-process")
    Rel(endpoints, grpc_client, "Fetches market data", "gRPC")
    Rel(mediatr, entities, "Creates / mutates domain objects", "In-process")
    Rel(mediatr, ef_core, "Reads / writes via ITradeEngineDbContext", "In-process")
    Rel(order_matcher, redis_service, "Reads live market prices", "In-process")
    Rel(order_matcher, ef_core, "Queries Pending orders (AsNoTracking)", "In-process")
    Rel(order_matcher, settlement, "Pushes TradeSettlementCommand", ".NET Channel")
    Rel(settlement, ef_core, "Atomic wallet + order updates (ExecuteUpdateAsync)", "In-process")
    Rel(settlement, signalr_hub, "Pushes OrderFilled notification", "In-process")
    Rel(settlement, ef_core, "Writes TradeOutboxMessage", "In-process")
    Rel(outbox, ef_core, "Polls unprocessed outbox messages", "In-process")
    Rel(outbox, rabbitmq_pub, "Forwards events to broker", "In-process")
    Rel(rmq_consumer, broker, "Consumes AI sentiment results", "AMQP")
    Rel(rmq_consumer, signalr_hub, "Broadcasts AI signal updates", "In-process")
    Rel(signalr_hub, signalr_client, "Pushes targeted events", "WSS")
    Rel(grpc_client, ingestor, "GetKlines, GetOrderBook, SubscribeSymbol", "gRPC")
    Rel(ef_core, db, "SQL queries", "TCP")
    Rel(redis_service, cache, "GET / SET", "TCP")
    Rel(rabbitmq_pub, broker, "AMQP publish", "AMQP")
```

---

## 4. Key Architectural Pattern — Channel-Based Settlement Pipeline

The matching engine uses .NET Channels to achieve lock-free throughput. This is the core design decision that eliminates database deadlocks under high concurrency.

```mermaid
sequenceDiagram
    participant C as Web Client
    participant API as Trade Engine API
    participant OMW as OrderMatchingWorker
    participant Ch as .NET Channel
    participant TSW as TradeSettlementWorker
    participant DB as PostgreSQL
    participant SR as SignalR Hub

    C->>API: POST /api/v1/orders (LIMIT BUY)
    API->>DB: INSERT Order (Status=Pending)
    API-->>C: 200 OK { orderId }

    Note over OMW: Runs continuously as BackgroundService
    OMW->>DB: SELECT orders WHERE Status=Pending (AsNoTracking)
    OMW->>OMW: Match against MarketStateCache (Redis price)
    OMW->>Ch: Write TradeSettlementCommand(orderId, price)

    Note over TSW: Single-threaded consumer — no concurrent writes
    TSW->>Ch: Read TradeSettlementCommand
    TSW->>DB: ExecuteUpdateAsync SET Amount = Amount + X (atomic)
    TSW->>DB: ExecuteUpdateAsync SET Status = Filled, ExecutionPrice = X
    TSW->>DB: INSERT TradeOutboxMessage
    TSW->>SR: Notify user (OrderFilled)
    SR-->>C: WebSocket push → Toast notification + portfolio refresh
```
