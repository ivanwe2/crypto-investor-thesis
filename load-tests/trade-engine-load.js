import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// --- Custom Metrics ---
const orderInsertionLatency = new Trend('order_insertion_latency_ms');
const orderbookLatency      = new Trend('orderbook_fetch_latency_ms');
const orderFailureRate      = new Rate('order_failure_rate');

// --- Test Configuration ---
//
// Architecture under test:
//   50 VUs each simulate a DIFFERENT user (unique JWT, unique rate-limit bucket).
//   Each user is capped at 10 orders/sec by the Token Bucket rate limiter.
//   Total intentional throughput: 50 users × 10/s = up to 500 orders/sec.
//
// Scenario A — build_book:
//   50 VUs place LIMIT BUY orders continuously for 30s.
//   Measures raw insertion throughput of the OrderMatchingWorker + Channel pipeline.
//
// Scenario B — consume_liquidity:
//   Ramps from 0 → 50 VUs placing MARKET BUY orders, starting at t=15s once the
//   book has liquidity. After each market order, immediately reads the order book
//   to measure Redis read latency post-settlement.
//
export const options = {
    scenarios: {
        build_book: {
            executor: 'constant-vus',
            vus: 50,
            duration: '30s',
            exec: 'insertLimitOrders',
        },
        consume_liquidity: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 20 },
                { duration: '15s', target: 50 },
                { duration: '5s',  target: 0  },
            ],
            exec: 'insertMarketOrders',
            startTime: '15s',
        },
    },
    thresholds: {
        'order_insertion_latency_ms': ['p(95)<100'],  // 95% of accepted orders under 100ms
        'orderbook_fetch_latency_ms': ['p(95)<200'],  // Order book read under 200ms
        'order_failure_rate':         ['rate<0.05'],  // Less than 5% failure (allows for InsufficientFunds near test end)
    },
};

const BASE_URL = __ENV.TRADE_ENGINE_URL || 'http://host.docker.internal:5000/api';
// One test user per VU slot. 100 covers both scenarios running concurrently (max vus_max).
const NUM_TEST_USERS = 100;

// ---------------------------------------------------------------------------
// setup() — runs ONCE before any VU starts.
//
// Registers NUM_TEST_USERS test accounts (idempotent: re-registration returns
// 400 "Username taken" which we ignore) then logs each one in to get a fresh JWT.
// Returns an array of tokens indexed 0..N-1.
//
// Each registered user receives 100,000 USDT and 50 BTC from AuthService.RegisterAsync.
// Orders use tiny BTC quantities so wallets are not exhausted mid-test:
//   0.0001–0.001 BTC × $50,000 = $5–$50 per order → 2,000–20,000 orders before dry.
// ---------------------------------------------------------------------------
export function setup() {
    const tokens = [];
    const jsonHeaders = { 'Content-Type': 'application/json' };

    console.log(`Provisioning ${NUM_TEST_USERS} test users...`);

    for (let i = 1; i <= NUM_TEST_USERS; i++) {
        const username = `loadtest_${String(i).padStart(3, '0')}`;
        const password = 'LoadTest123!';
        const body     = JSON.stringify({ username, password });

        // Register — may return 400 if user already exists from a previous run, that's fine
        http.post(`${BASE_URL}/v1/auth/register`, body, { headers: jsonHeaders });

        // Always login to get a fresh JWT
        const loginRes = http.post(`${BASE_URL}/v1/auth/login`, body, { headers: jsonHeaders });

        if (loginRes.status === 200) {
            tokens.push(JSON.parse(loginRes.body).token);
        } else {
            console.error(`Failed to login ${username}: ${loginRes.status} ${loginRes.body}`);
        }
    }

    check(tokens, {
        [`setup: all ${NUM_TEST_USERS} users authenticated`]: (t) => t.length === NUM_TEST_USERS,
    });

    console.log(`Setup complete. ${tokens.length} tokens ready.`);
    return { tokens };
}

// ---------------------------------------------------------------------------
// Scenario A — Build the Order Book (LIMIT BUY orders)
//
// Each VU picks a unique token via its VU number so they never share a
// rate-limit partition. 50 VUs × 10/s = up to 500 orders/sec total.
//
// Uses BUY-only because test users only have USDT (no BTC to sell).
// Small quantities (0.0001–0.001 BTC) keep wallets solvent for the full 30s.
// ---------------------------------------------------------------------------
export function insertLimitOrders(data) {
    const token   = data.tokens[(__VU - 1) % data.tokens.length];
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    const midPrice = 50_000;
    // BUY below mid-price (bids): random spread 0–$500 below mid
    const price    = midPrice - Math.random() * 500;
    // Tiny quantity so wallets aren't exhausted: $5–$50 per order
    const quantity = parseFloat((Math.random() * 0.0009 + 0.0001).toFixed(4)); // 0.0001–0.001 BTC

    const payload = JSON.stringify({
        symbol:      'BTCUSDT',
        side:        1,               // OrderSide.Buy = 1
        type:        2,               // OrderType.Limit = 2
        quantity:    quantity,
        targetPrice: parseFloat(price.toFixed(2)),
    });

    const res     = http.post(`${BASE_URL}/v1/orders`, payload, { headers });
    const success = check(res, {
        'limit order accepted': (r) => r.status === 200 || r.status === 201,
    });

    orderFailureRate.add(!success);
    if (success) {
        orderInsertionLatency.add(res.timings.duration);
    }

    sleep(0.1); // ~10 req/s per VU — sustains load without overwhelming a single token bucket
}

// ---------------------------------------------------------------------------
// Scenario B — Consume Liquidity (MARKET SELL orders + Order Book reads)
//
// Places MARKET SELL orders against the BUY-side liquidity (bids) built by
// Scenario A. Each MARKET SELL matches immediately against the best bid,
// forcing TradeSettlementWorker to execute ExecuteUpdateAsync() atomically
// in PostgreSQL. Immediately reads the order book after each settlement.
// Test users have 50 BTC, so they can sustain ~30 orders at 0.001–0.01 BTC.
// ---------------------------------------------------------------------------
export function insertMarketOrders(data) {
    const token   = data.tokens[(__VU - 1) % data.tokens.length];
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

    // Larger quantities to sweep price levels and force settlement
    const quantity = parseFloat((Math.random() * 0.009 + 0.001).toFixed(4)); // 0.001–0.01 BTC

    const payload = JSON.stringify({
        symbol:   'BTCUSDT',
        side:     2,  // OrderSide.Sell = 2  (consumes bids built by Scenario A)
        type:     1,  // OrderType.Market = 1
        quantity: quantity,
    });

    const orderRes = http.post(`${BASE_URL}/v1/orders`, payload, { headers });
    check(orderRes, {
        'market order accepted': (r) => r.status === 200 || r.status === 201,
    });

    // Read the live order book — measures Redis snapshot latency post-settlement
    const bookRes = http.get(`${BASE_URL}/v1/markets/BTCUSDT/orderbook?limit=10`, { headers });
    const bookOk  = check(bookRes, {
        'orderbook fetch succeeded': (r) => r.status === 200,
    });

    if (bookOk) {
        orderbookLatency.add(bookRes.timings.duration);
    }

    sleep(1); // Market orders are intentionally less frequent
}
