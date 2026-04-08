# Performance Improvements

This document describes five targeted improvements made to the system following the
initial load-testing analysis. Each change addresses a specific, measured bottleneck
identified in the [performance analysis](performance-analysis.md).

---

## Baseline — What the Load Tests Revealed

Before these changes, Run 4 (TTL = 5s) produced:

| Metric | Result | Threshold | Status |
|---|---|---|---|
| `order_insertion_latency_ms` p(95) | 80.8ms | < 100ms | ✅ |
| `orderbook_fetch_latency_ms` p(95) | 291ms | < 200ms | ❌ |
| `order_failure_rate` | 0% | < 5% | ✅ |

Two structural issues were also identified that would not show up in a short-duration test
but would degrade at scale:

- No database indices on `orders.Status` or `orders.Symbol` — full table scans on every
  matching-engine startup and every settlement write.
- PostgreSQL running with Alpine defaults (`max_connections = 100`) while the .NET connection
  pool was configured at `poolSize = 1024` — causing silent connection wait queuing.

---

## Change 1 — Background Order Book Refresh (HIGH IMPACT)

**Problem:** The `GetOrderBookDepth` gRPC handler used a lazy read-through cache with a
5-second TTL. During the ramp-up phase of the `consume_liquidity` scenario (only ~10 active
VUs), cache misses fell through to a live `GET https://api.binance.com/api/v3/depth` call
(~270ms). This produced a bimodal latency distribution: 7.6ms median (cache hit) vs 291ms
p(95) (cache miss).

**Fix:** A background goroutine in the ingestor proactively refreshes the order book cache
every 3 seconds for all currently subscribed symbols, decoupling the slow Binance REST call
from the hot gRPC request path entirely.

```
Before:  gRPC request → cache miss → Binance REST (~270ms) → respond
After:   gRPC request → cache hit  → respond (~3–10ms)
         [background] every 3s → Binance REST → update cache (off the hot path)
```

**Files changed:**
- [ingestor/cmd/server/main.go](../../ingestor/cmd/server/main.go) — new background goroutine
- [ingestor/internal/exchange/client.go](../../ingestor/internal/exchange/client.go) — `ActiveSymbols()` method on `SubscriptionManager`

**Measured result:** The background refresh reduced p(90) from 274ms to **11ms** (96%
improvement), confirming the cache is warm for 90%+ of requests. The median dropped from
7.6ms to 3.6ms. However, p(95) only improved from 291ms to 275ms — a residual ~5% of
requests still reach Binance REST during the 0–3 second window between service start and the
goroutine's first tick. Pre-warming the cache synchronously at startup (before the gRPC
server begins accepting connections) would close this remaining gap entirely.

---

## Change 2 — Database Indices on `orders.Status` and `(Symbol, Status)` (HIGH IMPACT)

**Problem:** The `orders` table had an index on `UserId` but none on `Status` or `Symbol`.
Two hot query paths hit this table without index support:

1. `OrderMatchingWorker` startup: `WHERE Status = 'Pending'` — full sequential scan at boot.
2. `TradeSettlementWorker` settlement: `WHERE Id = X AND Status = 'Pending'` — only the PK
   lookup is indexed; the `Status` predicate is evaluated without an index.

At 10,000+ orders (achievable in minutes under load), these become meaningful table scans.

**Fix:** Two new EF Core indices added to `OrderConfiguration`, with a migration applied:

```csharp
builder.HasIndex(o => o.Status);
builder.HasIndex(o => new { o.Symbol, o.Status });  // covers matching worker's startup query
```

**Files changed:**
- [OrderConfiguration.cs](../../trade-engine/TradeEngine/src/TradeEngine.Infrastructure/Persistence/Configurations/OrderConfiguration.cs)
- New migration: `AddOrderStatusSymbolIndices`

**Expected result:** Startup order load and settlement predicates become B-tree index seeks
(O(log n)) instead of sequential scans. Critical for correctness at scale — not just
load-test scenarios.

---

## Change 3 — PostgreSQL Tuning and Connection Pool Alignment (MEDIUM IMPACT)

**Problem:** Two misconfigurations compounded each other:

1. PostgreSQL ran with Alpine image defaults: `max_connections = 100`, `shared_buffers = 128MB`,
   `work_mem = 4MB`.
2. The .NET `AddDbContextPool` was configured with `poolSize = 1024`.

With 1024 pooled connections attempting to connect to a Postgres instance capped at 100,
any load above ~100 concurrent DB operations silently queued at the connection level. This
is the likely explanation for the 144ms → 81ms insertion latency improvement observed
between Runs 3 and 4 — the pool was not fully saturated in Run 4 purely by coincidence of
test timing, not by design.

**Fix:**

`docker-compose.yml` — PostgreSQL now starts with explicit tuning flags:
```yaml
command: >
  postgres
  -c max_connections=200
  -c shared_buffers=256MB
  -c work_mem=16MB
  -c effective_cache_size=512MB
  -c checkpoint_completion_target=0.9
  -c wal_buffers=16MB
```

`ServiceCollectionExtensions.cs` — pool size aligned to the new ceiling:
```csharp
}, poolSize: 100); // Aligned to postgres max_connections=200; headroom for other clients
```

**Files changed:**
- [docker-compose.yml](../../docker-compose.yml)
- [ServiceCollectionExtensions.cs](../../trade-engine/TradeEngine/src/TradeEngine.Api/Extensions/ServiceCollectionExtensions.cs)

**Expected result:** Eliminates hidden connection wait queuing. The `shared_buffers` increase
(128MB → 256MB) allows PostgreSQL to cache more of the `orders` and `wallets` tables in
shared memory, reducing disk I/O for repeated reads.

---

## Change 4 — Parallel Settlement Lanes (MEDIUM IMPACT)

**Problem:** `TradeSettlementWorker` processed orders from a single `SettlementQueue`
channel with a single consumer loop. Each settlement opened a PostgreSQL transaction,
acquired write locks on the `orders` and `asset_balances` rows, and committed serially.
At 23 settlements/second, this single-threaded write path competed with
`OrderMatchingWorker`'s read queries for PostgreSQL connection pool slots, raising
insertion p(95) from 26ms (settlement idle) to 80.8ms (settlement active).

**Fix:** `SettlementQueue` is replaced by a partitioned structure with 4 independent
channels. Orders are routed to a lane by `Math.Abs(symbol.GetHashCode()) % 4`. The
`TradeSettlementWorker` launches one consumer `Task` per lane, so settlements for
different symbols proceed concurrently while settlements for the same symbol remain
serialised within their lane.

```
Before:  single channel → single consumer → serial PostgreSQL writes

After:   symbol hash % 4
          ├── lane 0 (e.g. BTCUSDT) → consumer 0 → independent transaction
          ├── lane 1 (e.g. ETHUSDT) → consumer 1 → independent transaction
          ├── lane 2 (e.g. BNBUSDT) → consumer 2 → independent transaction
          └── lane 3 (e.g. SOLUSDT) → consumer 3 → independent transaction
```

`TradeSettlementCommand` gains a `Symbol` field so the queue can route correctly without
a database lookup.

**Files changed:**
- [SettlementQueue.cs](../../trade-engine/TradeEngine/src/TradeEngine.Infrastructure/Services/TradeSettlement/SettlementQueue.cs)
- [TradeSettlementWorker.cs](../../trade-engine/TradeEngine/src/TradeEngine.Infrastructure/BackgroundServices/TradeSettlement/TradeSettlementWorker.cs)
- [TradeSettlementCommand.cs](../../trade-engine/TradeEngine/src/TradeEngine.Infrastructure/Services/TradeSettlement/TradeSettlementCommand.cs)
- [OrderMatchingWorker.cs](../../trade-engine/TradeEngine/src/TradeEngine.Infrastructure/BackgroundServices/OrderMatching/OrderMatchingWorker.cs)

**Important caveat:** Per-user `AssetBalance` rows are shared across symbols — a user's
USDT balance is debited for both BTCUSDT and ETHUSDT buys. Lane-level parallelism prevents
symbol-level write-lock contention but does not eliminate user-level contention when the
same user trades multiple symbols simultaneously. Under the current single-symbol load test
(BTCUSDT only), the 4 lanes still serialise all settlements through lane 0, so the full
benefit requires a multi-symbol workload.

**Expected result:** Under a multi-symbol load test, settlement throughput scales near-linearly
with lane count (up to 4×). Under the current single-symbol test, the structural change has
near-zero regression risk and positions the engine for multi-symbol workloads.

---

## Change 5 — Stale Cache Fallback on Binance REST Error (LOW IMPACT)

**Problem:** On a cache miss, if the upstream `GET https://api.binance.com/api/v3/depth`
returned an error or spiked above the 10-second HTTP timeout, the `GetOrderBookDepth` gRPC
call returned `nil, err` — propagating the failure to every caller in the trade-engine.
The observed maximum latency spike (1,093ms) was one such Binance API instability event.

**Fix:** When `exchange.FetchOrderBookDepth` returns an error, the handler now checks for
any existing snapshot in the cache — regardless of age (`GetOrderBookStale`) — and serves
it with a warning log rather than failing the request outright.

```go
depthData, err := exchange.FetchOrderBookDepth(ctx, req.Symbol, req.Limit)
if err != nil {
    if stale, ok := s.cache.GetOrderBookStale(req.Symbol); ok {
        slog.Warn("Serving stale order book due to Binance REST error", "symbol", req.Symbol)
        // build and return response from stale snapshot
    }
    return nil, err  // only hard-fail if no snapshot exists at all
}
```

**Files changed:**
- [grpc.go](../../ingestor/internal/grpc/grpc.go)
- [market_cache.go](../../ingestor/internal/cache/market_cache.go) — `GetOrderBookStale()` method

**Expected result:** Transient Binance API errors no longer surface as failures to the
trade-engine or the end user. The order book panel shows a slightly stale snapshot rather
than an error state.

---

## Summary

| # | Change | Bottleneck addressed | Expected improvement |
|---|---|---|---|
| 1 | Background order book refresh | Lazy cache misses → 270ms Binance round-trip | orderbook p(90): 274ms → 11ms (96% ↓); p(95): 291ms → 275ms (startup-window misses remain) |
| 2 | DB indices on Status + Symbol | Full table scans on matching/settlement queries | Prevents O(n) scans at scale |
| 3 | PostgreSQL tuning + pool alignment | Connection pool/DB cap mismatch, insufficient buffer cache | Eliminates hidden connection queuing |
| 4 | Parallel settlement lanes | Single-threaded settlement serialising write locks | Up to 4× settlement throughput under multi-symbol load |
| 5 | Stale cache fallback | Binance API errors propagating as gRPC failures | Graceful degradation on upstream instability |
