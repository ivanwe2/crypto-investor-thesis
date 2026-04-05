# ✨ Platform Features

The **Crypto Investor** platform offers a comprehensive suite of features designed for both novice and advanced traders.

## 📈 Real-Time Market Data
- **Live Order Books:** Sub-millisecond market data ingestion from external exchanges using WebSockets and Go.
- **Seamless Updates:** Market changes are pushed to the client interface instantly via SignalR without polling.

## ⚡ High-Performance Trading
- **Lock-Free Matching Engine:** Uses advanced `.NET Channels` to decouple the matching pipeline, allowing high-throughput order processing.
- **Atomic Settlement:** Ensures ACID compliance on all wallet and order state changes using Entity Framework Core's `ExecuteUpdateAsync`.

## 🧠 AI-Driven Insights
- **Sentiment Analysis:** Integrates FinBERT models via a dedicated Python microservice.
- **Actionable Data:** Automatically scores incoming news and market chatter to provide positive/negative/neutral sentiment indicators directly on the trading dashboard.

## 🔐 Security & Reliability
- **Clean Architecture:** Ensures business logic is isolated, strictly tested, and free from framework lock-in.
- **JWT Authentication:** Secure user sessions validated natively within the core trade engine.
- **Microservices Isolation:** Failure in one domain (e.g., AI Analyst) does not impact the core trading and matching pipelines.

## 📊 Comprehensive Observability
- **Distributed Tracing:** Every request is traced across the React client, .NET engine, Go ingestor, and Python analyst using OpenTelemetry.
- **Grafana Dashboards:** Out-of-the-box dashboards for infrastructure health, active connections, order matching latency, and system resource utilization.
