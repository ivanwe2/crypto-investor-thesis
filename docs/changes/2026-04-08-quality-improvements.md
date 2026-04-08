# Quality Improvements: Unit Tests, Concurrency Safety, and Outbox Resilience

**Date**: 2026-04-08
**Branch**: `feature/v1.0`
**Services affected**: `trade-engine`, `ingestor`, `infra/observability`

---

## Motivation

An AI-generated analysis of the platform (Gemini) was reviewed against the actual implementation. The majority of its recommendations were incorrect — for example, it described the order matching process as "database-bound" when the pipeline already operates in-memory via .NET Channels, and it claimed wallet updates had a lost-update problem when `ExecuteUpdateAsync` already generates atomic SQL. However, three genuine issues were identified and confirmed against the code:

1. The unit test project contained only an empty stub file with no real tests.
2. `PlaceOrderCommandHandler` had no handler for `DbUpdateConcurrencyException`, leaving the optimistic concurrency lock on `Wallet.Version` without any recovery logic.
3. `OutboxProcessorWorker` retried failing messages indefinitely with no upper bound, creating a poison-pill risk.

All three were fixed. Telemetry was also extended to make the new failure paths observable.

---

## 1. Unit Tests

### What was done

`UnitTest1.cs` (an empty stub) was deleted and replaced with 49 real tests across five files, organized into `Domain/` and `Handlers/` subdirectories under `test/TradeEngine.UnitTests/`.

| File | Tests | Coverage area |
|------|-------|---------------|
| `Domain/OrderTests.cs` | 8 | `Order.Create` validation: zero/negative quantity, limit order with zero price, stop orders missing stop price, valid construction, symbol uppercasing |
| `Domain/WalletTests.cs` | 8 | `Wallet.Withdraw` and `Wallet.Deposit`: missing currency, insufficient balance, negative/zero amounts, exact balance withdrawal, multi-currency isolation, negative deposit |
| `Domain/DormantOrderTrackerTests.cs` | 8 | `DormantOrderTracker.EvaluateTriggers`: all four StopLoss/TakeProfit trigger branches (price above/below threshold), triggered order removal, symbol isolation |
| `Domain/OutboxMessageRetryTests.cs` | 5 | Outbox retry gate: counts below, at, and above `MaxRetryCount`; failure state fields; success state clearing |
| `Handlers/PlaceOrderHandlerTests.cs` | 20 | `PlaceOrderCommandHandler`: `WalletNotFound`, `InsufficientBalance`, `ValidBuyOrder`, `ValidSellOrder`, `ZeroTargetPrice`, `ConcurrencyExhaustion` |

**Dependencies added to `TradeEngine.UnitTests.csproj`:**
- `FluentAssertions 6.12.0`
- `NSubstitute 5.1.0`
- `MockQueryable.NSubstitute 7.0.3`
- Project references to `TradeEngine.Domain`, `TradeEngine.Application`, `TradeEngine.Infrastructure`

All 49 tests pass.

---

## 2. Balance Reservation Race Condition Fix

### Why it was a real issue

`Wallet` uses `IsRowVersion()` on its `Version` field, which causes EF Core to emit an optimistic concurrency check on every `UPDATE`. If two concurrent requests both read the same wallet version and attempt to write simultaneously, one will throw `DbUpdateConcurrencyException`. Without a handler, that exception would propagate unhandled to the HTTP layer, producing a 500 response and leaving the wallet in an inconsistent in-memory state for the duration of the request.

### What was done

`PlaceOrderCommandHandler` was restructured as a retry loop with a maximum of three attempts (`MaxConcurrencyRetries = 3`). On each iteration:

1. The wallet is reloaded fresh from the database.
2. The balance withdrawal is attempted in-memory.
3. `SaveChangesAsync` is called. If it succeeds, the loop breaks.
4. If `DbUpdateConcurrencyException` is thrown and retries remain, the partially constructed `Order` entity is removed from the change tracker and the loop continues.
5. After three failed attempts, the handler returns `Result.Failure("Order.ConcurrencyConflict")` and logs an error.

Rejections due to insufficient balance are counted separately and are not retried.

```csharp
for (int attempt = 1; attempt <= MaxConcurrencyRetries; attempt++)
{
    wallet = await dbContext.Wallets
        .Include(w => w.Balances)
        .SingleOrDefaultAsync(w => w.UserId == request.UserId, cancellationToken);
    // ... withdraw, create order ...
    try
    {
        await dbContext.SaveChangesAsync(cancellationToken);
        break;
    }
    catch (DbUpdateConcurrencyException) when (attempt < MaxConcurrencyRetries)
    {
        dbContext.Orders.Remove(order);
        order = null;
    }
    catch (DbUpdateConcurrencyException)
    {
        return Result.Failure<OrderResponse>(new Error("Order.ConcurrencyConflict", "..."));
    }
}
```

---

## 3. Outbox Poison-Pill Protection

### Why it was a real issue

`OutboxProcessorWorker` polled for all unprocessed messages and retried them in every cycle. There was no per-message retry ceiling. A message that consistently fails (e.g., due to a malformed payload or a downstream RabbitMQ schema mismatch) would block the tail of the outbox queue on every poll iteration, indefinitely consuming processor time and log storage.

### What was done

**Domain entity (`TradeOutboxMessage`):** Two fields added:
- `RetryCount int` — tracks how many publish attempts have failed (default 0).
- `FailedAt DateTime?` — records the timestamp of the most recent failure.

**Worker (`OutboxProcessorWorker`):** The following changes were made:
- `MaxRetryCount = 5` constant defined.
- The query now filters out messages where `RetryCount >= MaxRetryCount`, so exhausted messages are never loaded again.
- The batch `try/catch` was replaced with a per-message `try/catch`, so one failing message does not abort the entire batch.
- On failure: `RetryCount` is incremented and `FailedAt` is set.
- When `RetryCount` reaches `MaxRetryCount`, `tradingMetrics.RecordOutboxDeadLetter()` is called and the message is logged as a dead letter.

Messages in the dead-letter state remain in the table for forensic inspection but are permanently excluded from processing.

**EF Core migration:** `20260408143105_AddOutboxRetryCount` adds `RetryCount integer NOT NULL DEFAULT 0` and `FailedAt timestamp with time zone NULL` to the `trade_outbox_messages` table.

---

## 4. Telemetry Extensions

### New metrics

#### `ingestor` (Go)

| Metric | Type | Description |
|--------|------|-------------|
| `ingestor.messages_dropped` | `Int64Counter` | Binance trade messages dropped because the internal channel buffer was full, tagged by `symbol` |

This counter is incremented in `exchange/client.go` in the `select { default: }` branch of the message dispatch loop, where back-pressure causes a drop.

#### `trade-engine` (.NET)

| Metric | Type | Description |
|--------|------|-------------|
| `trade_engine.orders_rejected` | `Counter<long>` | Orders rejected at placement, tagged by `rejection_reason` (e.g., `insufficient_balance`, `concurrency_conflict`) |
| `trade_engine.outbox_dead_letters` | `Counter<long>` | Outbox messages that have reached `MaxRetryCount` and entered dead-letter state |

Both are registered in `TradingMetrics` and exposed via `RecordOrderRejected(string reason)` and `RecordOutboxDeadLetter()`.

### Grafana dashboard updates

**`trading-overview.json` — fixes and new panels:**

- Redis Cache Hit Ratio: denominator wrapped in `clamp_min(..., 1)` to prevent NaN on cold start.
- AI Inference Duration: P99 target line added to the existing histogram panel.
- Five new panels added (y=32 and y=40 rows):
  1. *Ingestor Messages Dropped Rate* — timeseries by `symbol`, red color scheme.
  2. *Ingestor WebSocket Reconnections* — stat panel, increase over 1h, green/yellow/red thresholds.
  3. *Order Rejection Rate* — timeseries by `rejection_reason`.
  4. *AI Analyses Performed Rate* — timeseries in analyses/second.
  5. *Outbox Dead Letters* — stat panel, increase over 1h, thresholds: 0 = green, 1 = yellow, 5 = red.

**`infrastructure-health.json` — panel rename:**

- "Redis Cache Hit Rate" renamed to "Redis Server Keyspace Hit Rate" to accurately reflect that the underlying metric (`redis_keyspace_hits_total`) comes from the redis-exporter and measures server-level keyspace hits, not the application-level cache hit rate tracked by `trade-engine`.

---

## Testing

All 49 new unit tests pass. The test suite covers:

- Domain entity validation (orders, wallets, stop/take-profit triggers).
- Outbox retry gate boundary conditions.
- Handler-level integration scenarios including concurrency exhaustion.

Run with:

```bash
cd trade-engine
make test
```

---

## Migration

A database migration must be applied before deploying this version to any environment.

**Migration name:** `20260408143105_AddOutboxRetryCount`

**Schema change:** Adds two columns to `trade_outbox_messages`:

```sql
ALTER TABLE trade_outbox_messages
    ADD COLUMN "RetryCount" integer NOT NULL DEFAULT 0,
    ADD COLUMN "FailedAt"   timestamp with time zone NULL;
```

Apply via:

```bash
cd trade-engine
make db-update
```

The migration is non-destructive. Existing rows receive `RetryCount = 0` and `FailedAt = NULL` automatically via the column default, and will continue to be processed normally.
