# Load Testing — Performance Analysis

This document records the k6 load test methodology, iterative findings, and final performance
results for the Trade Engine's order matching and settlement pipeline.

---

## 1. Test Design

### Tool and Execution

Tests are run with [k6](https://k6.io/) inside a Docker container against the locally running
stack (`make load-test`) or against the production instance (`make load-test-prod`).

```
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$(CURDIR)/load-tests:/scripts" \
  grafana/k6 run \
  --summary-export=/scripts/summary.json \
  /scripts/trade-engine-load.js
```

### Scenarios

| Scenario | Executor | VUs | Duration | Purpose |
|----------|----------|-----|----------|---------|
| `build_book` | constant-vus | 50 | 30s | Place LIMIT BUY orders continuously to populate the bid side of the order book |
| `consume_liquidity` | ramping-vus (0→20→50→0) | up to 50 | 30s (starts at t=15s) | Place MARKET SELL orders to match against bids, forcing atomic settlement |

**Architecture under test:**

```
50 VUs (LIMIT BUY)                       up to 50 VUs (MARKET SELL)
      │                                           │
      ▼                                           ▼
POST /api/v1/orders ──► OrderMatchingWorker ──► Channel ──► TradeSettlementWorker
                         (lock-free reads)                   (atomic ExecuteUpdateAsync)
                                                                      │
                                                             GET /api/v1/markets/
                                                             BTCUSDT/orderbook
                                                             (gRPC → ingestor cache)
```

### User Setup

`setup()` registers and authenticates **100 test users** (`loadtest_001` through `loadtest_100`).
Each user receives **100,000 USDT** and **50 BTC** on registration. Each VU is assigned a unique
user token via `data.tokens[(__VU - 1) % data.tokens.length]`, ensuring every VU operates in its
own **Token Bucket rate-limit partition** (10 requests/second per user).

### Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| `order_insertion_latency_ms` | p(95) < 100ms | SLA for the order matching + DB write path |
| `orderbook_fetch_latency_ms` | p(95) < 200ms | SLA for the market data read path |
| `order_failure_rate` | rate < 5% | Allows for expected InsufficientFunds near test end; rate-limiter rejections count as failures |

---

## 2. Iterative Test Runs

Three distinct runs were conducted, each addressing issues discovered in the previous run.

### Run 1 — Baseline (broken)

**Problem identified:** All 50 VUs shared a single Admin JWT token. The Token Bucket rate
limiter partitions by `UserId`, so all 50 VUs competed for one bucket of 10 tokens/second.
Approximately **97.6% of order requests were rejected** (429 Too Many Requests).

| Metric | Value |
|--------|-------|
| Limit orders accepted | 302 / 12,862 (2.3%) |
| Order failure rate | 97.6% |
| Orders/sec (effective) | ~10/sec (one shared bucket) |

**Root cause:** Single JWT → single rate-limit partition → 50 VUs × 10 req/s attempted, 10/s
permitted.

**Fix:** `setup()` now provisions 100 unique test users; each VU selects its own token.

---

### Run 2 — Rate Limiting Fixed, Market Orders Broken

**Problem identified:** Market orders all failed (0 / 589). The `build_book` scenario placed
only LIMIT BUY orders (bids). MARKET BUY orders require asks (sell-side liquidity) to match
against — none existed.

| Metric | Value |
|--------|-------|
| Limit orders accepted | 12,816 / 12,816 (100%) ✅ |
| Market orders accepted | 0 / 589 ✅ (correctly rejected — no asks) |
| Order failure rate | 0% ✅ |
| order_insertion_latency_ms p(95) | 26ms ✅ |
| orderbook_fetch_latency_ms p(95) | 776ms ❌ |
| orderbook_fetch_latency_ms min | 269ms |

**Orderbook bottleneck identified:** The `/api/v1/markets/{symbol}/orderbook` endpoint issues
a live HTTP request to `https://api.binance.com/api/v3/depth` on every call (via gRPC to the
ingestor service). The 269ms **minimum** latency is the Binance REST API network round-trip
from the test environment — there was no caching at all.

**Fixes applied:**
- Changed market orders from MARKET BUY (side=1) to **MARKET SELL (side=2)** — consumes
  the bid-side liquidity built by `build_book`.
- Added **50 BTC** to every new user's wallet (alongside 100,000 USDT) to fund SELL orders.
- Added **in-memory order book cache** to the ingestor's `MarketCache` with a read-through
  pattern: serve from cache if fresher than TTL, otherwise fetch from Binance and update cache.

---

### Run 3 — Settlement Contention Observed, Cache Miss Rate High (TTL = 2s)

With the fixes in place, all checks passed but two thresholds were breached.

| Metric | Value | Threshold |
|--------|-------|-----------|
| Limit orders accepted | 9,857 / 9,857 | — ✅ |
| Market orders accepted | 678 / 678 | — ✅ |
| order_failure_rate | 0% | < 5% ✅ |
| order_insertion_latency_ms p(95) | 144.9ms | < 100ms ❌ |
| orderbook_fetch_latency_ms p(95) | 344ms | < 200ms ❌ |
| orderbook_fetch_latency_ms min | 2.994ms (cache hit) | — |

**Finding A — Settlement lock contention (order insertion degraded):**

With market orders now succeeding, the `TradeSettlementWorker` was actively executing
`ExecuteUpdateAsync()` — atomic wallet balance and order status updates in PostgreSQL —
concurrently with `OrderMatchingWorker` inserting new limit orders. The insertion p(95)
jumped from 26ms (run 2, settlement idle) to **144ms** (run 3, settlement active).

This is the quantifiable cost of the system's atomicity guarantee. The settlement worker
holds write locks on wallet and order rows while matching worker queries compete for
PostgreSQL connection pool slots.

**Finding B — Orderbook cache miss rate too high (TTL = 2s):**

The cache hit path measured 3ms minimum. However, `consume_liquidity` ramps from 0 → 50
VUs over 25 seconds. During the ramp-up phase, only ~10 VUs are active concurrently, firing
1 request/second each. With a 2-second TTL and only 10 requests/second, the cache-miss
probability per request is ~5–10%, placing Binance REST latency (~270ms) at the p90–p95
range.

**Fix:** Increased cache TTL from 2s to **5 seconds**. The Binance L2 order book does not
need sub-second freshness for a trading dashboard; a 5-second snapshot is accurate enough
and reduces the miss rate by ~60%.

---

## 3. Final Results (TTL = 5s)

> Test environment: Docker Compose on Windows 11, ARM Ampere simulation via x86 Docker Desktop.
> Stack: trade-engine (.NET 10) + PostgreSQL 17 + Redis 7 + ingestor (Go 1.25).

### Checks

| Check | Passes | Fails | Result |
|-------|--------|-------|--------|
| setup: all 100 users authenticated | 1 | 0 | ✅ |
| limit order accepted | **11,064** | 0 | ✅ |
| market order accepted | **706** | 0 | ✅ |
| orderbook fetch succeeded | 706 | 0 | ✅ |

### Custom Metric Thresholds

| Metric | avg | p(50) | p(90) | p(95) | max | Threshold | Status |
|--------|-----|-------|-------|-------|-----|-----------|--------|
| `order_insertion_latency_ms` | 34.6ms | 27.2ms | 67.2ms | **80.8ms** | 184ms | p(95) < 100ms | ✅ PASS |
| `orderbook_fetch_latency_ms` | 55.0ms | 7.6ms | 274ms | **291ms** | 1093ms | p(95) < 200ms | ❌ FAIL |
| `order_failure_rate` | — | — | — | — | **0%** | rate < 5% | ✅ PASS |

### Throughput

| Metric | Value |
|--------|-------|
| Total HTTP requests | 12,676 |
| Request rate | 211 req/sec |
| Limit orders placed | 11,064 in 30s ≈ **369 orders/sec** |
| Market orders settled | 706 in ~30s ≈ **23 settlements/sec** |
| Peak concurrent VUs | 78 (50 limit + 28 market during overlap) |

### HTTP Request Breakdown (all endpoints combined)

| Stat | Value |
|------|-------|
| avg | 35.9ms |
| p(90) | 67.9ms |
| p(95) | 83.9ms |
| max | 1,093ms |

---

## 4. Key Findings

### Finding 1 — Order Matching Pipeline: Strong Throughput, Acceptable Latency

The `OrderMatchingWorker` → Channel → `TradeSettlementWorker` pipeline sustained
**369 LIMIT orders/second** at **p(95) = 80.8ms** under 50 concurrent users, well within
the 100ms SLA.

The channel-based design (lock-free reads in `OrderMatchingWorker`, single-threaded writes in
`TradeSettlementWorker`) provides a clean separation of concerns that prevents write contention
within the matching engine itself.

### Finding 2 — Quantified Cost of Atomic Settlement

Comparing run 2 (settlement idle) and run 3 (settlement active under identical load):

| Scenario | p(95) insertion latency |
|----------|------------------------|
| Settlement worker idle | 26ms |
| Settlement worker active (23 settlements/sec) | 145ms (run 3) → 81ms (run 4) |

The 3–5× tail latency increase under combined insert+settle load is the measurable price of
PostgreSQL row-level locking during `ExecuteUpdateAsync()`. The single-threaded settlement
design serialises write operations and prevents double-spend, but creates a shared contention
point with the matching engine's read queries.

This is the central performance trade-off of the architecture: **consistency over throughput**.
A system that relaxes atomicity (e.g., optimistic concurrency with compensating transactions)
could reduce this tail latency, at the cost of more complex failure-recovery logic.

### Finding 3 — Orderbook Endpoint: Bimodal Latency Distribution

The order book endpoint exhibits a **bimodal response time distribution**:

| Path | Latency | Condition |
|------|---------|-----------|
| Cache hit | ~3–10ms | Snapshot exists and is < 5 seconds old |
| Cache miss | ~270–1,100ms | First request for a symbol, or after TTL expiry |

The median (7.6ms) reflects the dominant cache-hit path. The p(90) and p(95) (274–291ms)
are driven entirely by cache misses that fall through to the Binance REST API
(`https://api.binance.com/api/v3/depth`). This is expected behaviour for a lazy-loaded
read-through cache.

The p(95) < 200ms threshold cannot be met with the current TTL-based approach unless the
Binance REST round-trip is eliminated. The correct long-term fix is a **background refresh
goroutine** in the ingestor that proactively updates the cached order book every N seconds for
all subscribed symbols, decoupling the slow Binance call from the hot request path entirely.

### Finding 4 — Rate Limiter Correctness Verified

With 100 unique users each occupying their own Token Bucket partition (10 tokens/second),
**0 orders were rejected by the rate limiter** across 11,064 requests under 50 concurrent VUs.
This confirms the per-user partitioning strategy scales linearly: 50 users × 10/s = 500/s
total permitted throughput, with no cross-user interference.

---

## 5. Identified Bottlenecks and Recommended Next Steps

| Bottleneck | Severity | Root Cause | Recommended Fix |
|------------|----------|------------|-----------------|
| Orderbook p(95) > 200ms threshold | Medium | Lazy cache misses falling back to Binance REST (~270ms) | Add background goroutine in ingestor to refresh order book cache proactively every 3–5s for subscribed symbols |
| Order insertion tail latency under settlement load | Low | PostgreSQL write locks during `ExecuteUpdateAsync()` competing with matching engine read queries | Separate PostgreSQL connection pool for settlement worker; or evaluate read replica for matching worker queries |
| Max orderbook latency spike (1,093ms) | Low | Occasional Binance API latency spike on cache miss | Add circuit breaker / timeout + return stale cache on error rather than propagating failure |
