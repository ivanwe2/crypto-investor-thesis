# Architecture Decision Record: High-Frequency Matching Engine

## 1. The Challenge

In a standard CRUD application, processing an order involves loading a User's Wallet into memory, modifying the balance, and saving it back to the database. In a High-Frequency Trading (HFT) environment, hundreds of limit orders might execute simultaneously.

Initial load testing revealed a critical bottleneck: Optimistic Concurrency Exceptions (PostgreSQL xmin locks). When multiple background threads attempted to modify the same user's wallet at the same millisecond, the database correctly threw exceptions to prevent double-spending, causing valid trades to crash and retry infinitely.

## 2. The Solution: The Channel-Based Settlement Pipeline

To resolve database contention and maximize throughput, the system's architecture was decoupled using the Actor Model via .NET Channels. The execution flow was split into two strictly isolated components:

A. The Order Matcher (Read-Heavy, Lock-Free)

A background service (OrderMatchingWorker) runs sequentially, evaluating the in-memory MarketStateCache (updated directly via RabbitMQ) against "Pending" limit orders.

Performance: It queries PostgreSQL using .AsNoTracking(), preventing the Entity Framework Change Tracker from allocating unnecessary memory.

Memory Leak Prevention: Once an order is matched, its ID is placed into an IMemoryCache with a 1-minute absolute expiration. This prevents the Matcher from queueing the same order twice while waiting for the database to update, without causing infinite dictionary growth (memory leaks).

Handoff: Matched orders are placed into an unbounded Channel<TradeSettlementCommand>.

B. The Settlement Engine (Write-Heavy, Atomic)

A dedicated, single-threaded worker (TradeSettlementWorker) reads from the Channel. Because it is the only component authorized to modify wallet balances, database deadlocks are mathematically impossible.

Atomic Database Execution: Instead of the traditional "Read-Modify-Write" pattern, the Settlement Engine uses EF Core 9's ExecuteUpdateAsync().

Example: SET Amount = Amount + X.

This pushes the mathematical operation directly down to the PostgreSQL engine, bypassing the ORM's Change Tracker entirely. This guarantees ACID compliance in microseconds with zero concurrency crashes.

## 3. Real-Time Observability

Upon successful atomic settlement, the Settlement Worker invokes the SignalRTradeNotifier. Because the React client passes its JWT Token during the WebSocket handshake (accessTokenFactory), the .NET backend identifies the specific user's TCP connection and pushes a targeted OrderFilled event. This triggers a localized UI state update and a Toast Notification without requiring the user to refresh the page.