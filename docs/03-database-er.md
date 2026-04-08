# Database Entity-Relationship Diagram (ERD)

This document illustrates the PostgreSQL database schema for the Crypto Investor platform, derived directly from the Entity Framework Core domain model.

## Core Schema

The database enforces ACID compliance for all wallet mutations via EF Core's `ExecuteUpdateAsync()` pattern, which pushes atomic `SET Amount = Amount + X` operations directly to the PostgreSQL engine, bypassing the ORM change tracker entirely.

```mermaid
erDiagram
    USER ||--o{ ORDER : "places"
    USER ||--|| WALLET : "owns"
    WALLET ||--o{ ASSET_BALANCE : "holds"
    ORDER ||--o{ TRADE_OUTBOX_MESSAGE : "generates on fill"

    USER {
        uuid    Id          PK
        string  Username
        string  PasswordHash
        string  Role        "User | Admin"
        datetime CreatedAt
        datetime UpdatedAt
    }

    WALLET {
        uuid Id     PK
        uuid UserId FK
        uint Version       "Optimistic concurrency token"
    }

    ASSET_BALANCE {
        uuid    Id       PK
        uuid    WalletId FK
        string  Currency     "e.g. BTC, USDT"
        decimal Amount
    }

    ORDER {
        uuid     Id             PK
        uuid     UserId         FK
        string   Symbol             "e.g. BTCUSDT"
        int      Side               "Buy=1 | Sell=2"
        int      Type               "Market=1 | Limit=2 | StopLoss=3 | TakeProfit=4"
        decimal  Quantity
        decimal  TargetPrice        "0 for Market orders"
        decimal  StopPrice          "Null unless StopLoss/TakeProfit"
        decimal  ExecutionPrice     "Set on fill"
        int      Status             "Pending=1 | Filled=2 | Cancelled=3 | Rejected=4"
        datetime CreatedAt
        datetime ExecutedAt         "Null until filled or cancelled"
    }

    TRADE_OUTBOX_MESSAGE {
        uuid     Id              PK
        string   Type                "Event type name"
        string   Content             "JSON-serialised event payload"
        datetime OccurredOnUtc
        datetime ProcessedOnUtc      "Null until consumed by OutboxProcessor"
        string   Error               "Null on success"
    }
```

## Design Decisions

### 1. Wallet Aggregate Pattern
A single `Wallet` per user acts as an aggregate root. It holds many `AssetBalance` child records — one per currency (BTC, USDT, ETH, etc.). Balances are mutated with atomic SQL (`ExecuteUpdateAsync`) to prevent double-spending without the overhead of pessimistic locking.

The `Version` (uint, maps to PostgreSQL `xmin`) provides optimistic concurrency. If two workers attempt to write the same wallet simultaneously, the second write fails fast — no deadlock required.

### 2. Order Lifecycle (no separate Trade table)
There is no dedicated TRADE table. A settled trade is represented by an `Order` record reaching `Status = Filled` with `ExecutionPrice` set. The `TradeSettlementWorker` performs the fill atomically:
1. Updates `Order.Status → Filled` and sets `ExecutionPrice`
2. Calls `Wallet.Deposit` / `Wallet.Withdraw` via `ExecuteUpdateAsync`
3. Publishes a `TradeOutboxMessage` for downstream fanout (SignalR, AI pipeline)

### 3. Transactional Outbox Pattern
`TradeOutboxMessage` stores domain events durably in the same PostgreSQL transaction as the trade settlement. A background `OutboxProcessor` service polls for unprocessed messages and forwards them to RabbitMQ. This guarantees **at-least-once delivery** without distributed transactions: if the broker is down, messages stay in the table until it recovers.

### 4. Symbol Encoding
Orders reference the trading pair as a single `Symbol` string (`"BTCUSDT"`) rather than separate `BaseAsset`/`QuoteAsset` columns. This matches the Binance WebSocket feed format that the Ingestor ingests, eliminating any translation layer.
