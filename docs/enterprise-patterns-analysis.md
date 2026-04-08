# Enterprise Architecture & Scalability Analysis

> **Purpose:** This document evaluates the platform against enterprise-grade microservices standards, identifies genuine architectural gaps, and provides a prioritized plan for future improvements. Written for readers familiar with distributed systems but not necessarily with this specific codebase.

---

## 1. What's Already There (Stronger Than It Looks)

Before discussing gaps, it's worth being explicit about what's already implemented — because much of it is non-obvious to a casual reader and is well above typical project standards.

| Pattern | Status | Notes |
|---|---|---|
| Reverse proxy | Implemented | Nginx inside the web-client container routes `/api/` and `/hub` to the trade engine in production |
| External access via Cloudflare Tunnel | Implemented | Replaces the need for a traditional internet-facing load balancer |
| Network isolation | Implemented | Production uses separate `backend` and `frontend` Docker networks |
| Circuit breaker | Implemented | Polly library protects the AI Analyst integration — 3 failures → 30-second open state |
| Per-user rate limiting | Implemented | Token bucket limiter, 10 requests/second per user, falls back to IP-based limiting |
| Transactional outbox pattern | Implemented | Guarantees at-least-once delivery for trade events; max 5 retries before dead-letter state |
| Full observability stack | Implemented | OpenTelemetry → Prometheus (metrics) + Loki (logs) + Tempo (traces) → Grafana dashboards |
| API versioning | Implemented | URL-segment versioning (`/api/v1/`) |
| Graceful shutdown | Implemented | All services handle OS termination signals, drain in-flight work before exiting |
| Health checks | Implemented | Every service exposes a `/healthz` endpoint; the trade engine aggregates all dependencies |
| Message durability | Implemented | RabbitMQ queues and messages are durable and persistent across broker restarts |
| Distributed trace propagation | Implemented | W3C trace context injected into RabbitMQ message headers |
| Optimistic concurrency control | Implemented | Wallet version field prevents double-spending; retries on conflict (max 3 attempts) |
| Parallel settlement lanes | Implemented | 4 independent settlement lanes keyed by `symbol hash % 4` for multi-symbol throughput |
| Background cache refresh | Implemented | Ingestor refreshes the order book cache every 3 seconds off the hot path; serves stale data on error |
| Load testing & benchmarking | Implemented | k6 tests, 5 iterative runs with documented bottleneck analysis |

---

## 2. Genuine Architectural Gaps

### Tier 1 — Blockers for Horizontal Scaling

These gaps do not affect a single-node deployment but make it impossible to run more than one instance of any service without correctness issues.

---

#### Gap 1: No SignalR Backplane (Redis Pub/Sub)

**What the problem is:**
SignalR is the WebSocket layer that pushes real-time trade updates to browser clients. When a trade settles, the trade engine publishes an event to all clients subscribed to that trading symbol.

In the current architecture, the list of active WebSocket connections and group subscriptions is stored in-process memory. If you were to run two trade engine instances behind a load balancer, a trade settling on instance A would have no way to notify clients connected to instance B — those clients would silently miss updates.

**What the fix looks like:**
ASP.NET Core SignalR has a built-in Redis backplane integration. When enabled, all event broadcasts are routed through Redis Pub/Sub instead of in-process dispatch. Any instance can publish; all instances receive it and forward to their local connections. The code change is approximately 3 lines.

**Why it's not implemented:**
The Oracle Cloud deployment is single-node. There is no second instance to coordinate with, so this gap has no operational impact today.

**Recommended thesis treatment:**
Excellent topic for a "Scalability Limitations" chapter. Describe exactly what breaks without the backplane, what the fix is, and why the current single-node deployment is still a valid and deliberate architectural choice. Reference the Redis backplane pattern as the production path forward.

---

#### Gap 2: No Standalone API Gateway

**What the problem is:**
An API gateway is a dedicated network entry point that sits in front of all backend services. It handles routing, TLS termination, authentication offloading, rate limiting at the edge, and — critically — load balancing between multiple instances of each service.

The current production setup uses Nginx, but it runs *inside the web-client Docker container*. This means the web-client container is responsible for both serving the React application and acting as a proxy for API traffic. These are two distinct concerns collapsed into one container — a pragmatic choice for a single-node deployment, but an anti-pattern at scale.

Additionally, because the Nginx configuration is static, adding a second trade engine instance would require manually updating the config. There is no dynamic service discovery.

**What enterprise looks like:**
A standalone reverse proxy or API gateway — such as Traefik, Kong, or AWS API Gateway — sits as its own independently scalable component in the architecture. It discovers backend services automatically (via Docker labels, Kubernetes service objects, or a service registry like Consul) and can load balance across any number of instances without configuration changes.

**What a minimal improvement looks like:**
Replacing the in-container Nginx proxy with Traefik as a standalone Docker Compose service. Traefik reads Docker labels on service containers to configure routing dynamically. This:
- Decouples the API gateway from the web-client container
- Enables load balancing with no additional config
- Provides a built-in dashboard for routing visibility
- Is approximately 30 lines of Docker Compose configuration

**Recommended thesis treatment:**
This is the one gap worth implementing if any implementation work is done. Even without actually running multiple instances, the architecture is correct and extensible. Use it to compare: embedded Nginx (current) → standalone Traefik (improved) → Kong with plugins (enterprise) → AWS API Gateway (cloud-native). The comparison makes for a strong architecture chapter.

---

#### Gap 3: Non-Persistent In-Process Order Queue

**What the problem is:**
After the order matching worker finds two orders that match each other, it places them into an in-memory queue (`Channel<Order>`) to be picked up by the settlement worker. This queue is process-local — it exists only in RAM inside the running trade engine process.

If the trade engine restarts while orders are sitting in this queue waiting for settlement, those orders are lost. They were matched but never settled, and no record exists that matching occurred.

**The partial mitigation:**
The transactional outbox pattern handles events *after* settlement — it guarantees that once an order is written to the database as settled, the corresponding event will eventually be published to RabbitMQ. But the outbox doesn't cover the window between matching and settlement.

**What a durable alternative looks like:**
Replacing the in-memory channel with a durable queue — Redis Streams or a dedicated RabbitMQ queue — so that matched orders survive restarts. This is architecturally significant: the settlement worker would need to be redesigned to pull from an external queue rather than a local channel, which changes the deployment topology considerably.

**Recommended thesis treatment:**
Write about this in the context of the "durable subscriber" pattern and the general challenge of exactly-once semantics in distributed systems. Acknowledge that the outbox provides coverage at the settled-order boundary, explain the remaining gap at the matched-but-unsettled boundary, and describe what a fully durable pipeline would look like. This is a nuanced and honest discussion that demonstrates genuine understanding.

---

### Tier 2 — Resilience & Operational Completeness

These are patterns that don't block scaling but represent gaps in production-readiness.

---

#### Gap 4: No Dead-Letter Queues in RabbitMQ

**What the problem is:**
When the AI analyst service fails to process a trade event message (due to a model error, malformed payload, or transient failure), it calls `basic_nack` with `requeue=False`. This tells RabbitMQ to drop the message entirely. There is no way to inspect what failed, replay it, or alert on the failure.

**What the fix looks like:**
Configure a Dead-Letter Exchange (DLX) on the consumer queue. When a message is rejected, RabbitMQ routes it to the DLX instead of discarding it. A separate dead-letter queue collects these messages, which an operator can inspect via the RabbitMQ management UI and manually replay or discard.

This is a configuration change — approximately one argument added to the queue declaration in two places.

**Recommended action:**
Low-effort and high-value for demonstrating operational maturity. Worth implementing.

---

#### Gap 5: WebSocket Load Balancing Requires Sticky Sessions or a Backplane

**What the problem is:**
Standard HTTP load balancers route each request to a different backend instance (round-robin or least-connections). This works fine for REST APIs because each request is stateless. WebSocket connections are different — they are long-lived TCP connections pinned to a single server for the duration of the session.

If a load balancer routes a client's WebSocket upgrade request to instance A, and then routes their next HTTP request to instance B, the client loses their real-time subscription.

**Two solutions in industry:**
- **Sticky sessions (ip_hash):** The load balancer always routes a given client to the same backend instance. Simple but prevents true load distribution.
- **Shared backplane:** All instances share state via Redis or a message broker (see Gap 1). The load balancer can freely route to any instance.

**Recommended thesis treatment:**
A dedicated section explaining this trade-off. Cloudflare Tunnel, which is used in the current deployment, handles WebSocket proxying correctly for single-instance setups. This is good material for demonstrating understanding of network-layer concerns.

---

#### Gap 6: Hardcoded Service URLs (No Dynamic Service Discovery)

**What the problem is:**
Each service finds the others via hardcoded environment variables (`TRADE_ENGINE_GRPC_URL`, `INGESTOR_GRPC_ADDRESS`, etc.). If a service moves to a different host or port, every service that depends on it needs a config update and restart.

Docker Compose's internal DNS provides a basic form of service discovery — services can find each other by container name. But this breaks as soon as you have multiple instances of the same service, because there's no way to select a healthy instance or balance load.

**What enterprise looks like:**
- **Kubernetes:** Built-in DNS-based service discovery via Service objects. A `ClusterIP` service load balances across all matching pods automatically.
- **Consul:** Service registry with health checks, available in non-Kubernetes environments.
- **API Gateway with dynamic backends:** Traefik's Docker provider discovers services automatically via container labels.

**Recommended thesis treatment:**
Use this to frame a future work discussion on Kubernetes migration. The current env-var approach is reasonable for a fixed single-node deployment; explain what would change as you move to dynamic environments.

---

#### Gap 7: No PostgreSQL Read Replicas

**What the problem is:**
All database queries — both writes (order placement, settlement) and reads (portfolio views, order history) — go to a single PostgreSQL instance. At scale, read-heavy workloads would compete with write-heavy settlement operations for the same database connections and I/O bandwidth.

**What enterprise looks like:**
A PostgreSQL streaming replica configured as a read replica. Write queries go to the primary; read queries go to the replica. EF Core supports this pattern via multiple registered `DbContext` instances pointing to different connection strings.

**Recommended thesis treatment:**
Mention as a standard database scaling pattern. The current single-instance setup is appropriate for the expected load (documented at ~369 orders/second with room to grow), but acknowledge the ceiling.

---

#### Gap 8: No Container Resource Limits

**What the problem is:**
None of the Docker Compose service definitions specify CPU or memory limits. On a shared host, a single misbehaving container could consume all available resources and starve every other service — a noisy neighbor problem.

**What the fix looks like:**
A `deploy.resources.limits` block in each service definition specifying maximum CPU shares and memory. For example: 2 CPUs and 1GB RAM for the trade engine, 0.5 CPU and 256MB for the AI analyst.

**Recommended action:**
Trivial to add, demonstrates operational awareness.

---

### Tier 3 — Future Architecture Themes (Write Only)

The following patterns are genuine enterprise concerns but are too architecturally disruptive to implement within thesis scope. They are well-suited for a "Future Work" or "Production Considerations" chapter.

| Pattern | What it addresses | Why it's out of scope |
|---|---|---|
| **Kubernetes migration** | Orchestration, autoscaling, self-healing, rolling deploys | Entire paradigm shift; Docker Compose is sufficient for thesis |
| **Service mesh (Istio / Linkerd)** | Mutual TLS between services, traffic policies, retries at the network layer | Adds infrastructure complexity without changing application behavior |
| **Secrets management (HashiCorp Vault)** | Rotating credentials, audit trails, dynamic database passwords | Full operational discipline; environment variables are appropriate for thesis |
| **Database sharding** | Partition order data by symbol or user for horizontal write scaling | Requires schema redesign and routing logic |
| **Full CQRS + Event Sourcing** | Separate read/write models, full audit trail via event log | Architectural paradigm change, not an addition |
| **Schema/event versioning** | Backward compatibility when event schemas evolve across service versions | Relevant only with multiple teams or long-lived event consumers |
| **Horizontal Pod Autoscaler (HPA)** | Automatically scale service instances based on CPU or queue depth | Kubernetes-specific |

---

## 3. The Load Balancer / API Gateway Question (Direct Answer)

**The short answer:** You already have a reverse proxy. You don't have a standalone API gateway.

**What you have:**
- Nginx embedded in the web-client container routes `/api/` → trade engine REST and `/hub` → SignalR WebSocket. This is a legitimate reverse proxy configuration.
- Cloudflare Tunnel provides external access with TLS termination and DDoS protection at the edge. It effectively replaces the internet-facing load balancer that a traditional on-premises deployment would need.

**What's missing:**
The API gateway is coupled to the web-client container. These should be two separate things: a frontend server that serves the React application, and a gateway that routes API traffic. In the current setup, restarting or scaling the web-client also affects API routing.

**The pragmatic answer for a thesis:**
The current architecture is defensible and works correctly for a single-node deployment. The more interesting discussion for the written part is: "Here is what I have, here is where it differs from enterprise-scale deployments, and here is what the migration path looks like." That shows more maturity than implementing a complex gateway that isn't strictly needed.

**If you do want to implement it:**
Traefik is the lowest-friction option. It runs as a standalone Docker container, reads Docker labels from your other services to configure routing automatically, and provides a dashboard. The web-client's `nginx.prod.conf` proxy blocks (`location /api/` and `location /hub`) would be removed, and Traefik would take over that responsibility.

---

## 4. Implementation Reference (If You Revisit This)

The following is a prioritized list of changes, ordered by implementation effort vs. architectural value. These are not required for the thesis — they are documented here for reference if you decide to extend the project later.

### Priority 1 — Dead-Letter Queues (30 minutes)

**Files to change:**
- `ai-analyst/consumer.py` — add `x-dead-letter-exchange` argument to the queue declaration
- `ingestor/internal/messaging/publisher.go` — optionally declare the DLX on the exchange side

**What to add:**
```python
# ai-analyst/consumer.py — in queue_declare arguments
arguments={
    'x-dead-letter-exchange': 'dlx_trade_events',
    'x-message-ttl': 60000
}
```

Then declare a `dlq_trade_events` queue bound to `dlx_trade_events` to collect rejected messages.

**Verification:** Send a malformed message to `trade_events`. It should appear in `dlq_trade_events` in the RabbitMQ management UI at `http://localhost:15672`.

---

### Priority 2 — Traefik as Standalone API Gateway (2–4 hours)

**Files to change:**
- `docker-compose.yml` — add Traefik service, add Docker labels to trade-engine and web-client
- `docker-compose.prod.yml` — production Traefik config with Let's Encrypt or Cloudflare cert resolver
- `web-client/nginx.prod.conf` — remove `/api/` and `/hub` proxy blocks (Traefik takes over)

**What the Traefik service block looks like:**
```yaml
traefik:
  image: traefik:v3.0
  command:
    - "--providers.docker=true"
    - "--providers.docker.exposedbydefault=false"
    - "--entrypoints.web.address=:80"
    - "--api.dashboard=true"
  ports:
    - "80:80"
    - "8080:8080"   # Traefik dashboard
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Labels on trade-engine:**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.api.rule=PathPrefix(`/api`) || PathPrefix(`/hub`)"
  - "traefik.http.routers.api.entrypoints=web"
  - "traefik.http.services.api.loadbalancer.server.port=8080"
```

**Verification:** Traefik dashboard at `http://localhost:8080` → verify routes for trade-engine and web-client are listed and green.

---

### Priority 3 — Container Resource Limits (15 minutes)

**Files to change:**
- `docker-compose.yml`
- `docker-compose.prod.yml`

**What to add per service (example for trade-engine):**
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

Suggested limits per service:

| Service | CPU limit | Memory limit |
|---|---|---|
| trade-engine | 2.0 | 1G |
| ingestor | 1.0 | 512M |
| ai-analyst | 1.0 | 2G (model in memory) |
| web-client | 0.5 | 256M |
| PostgreSQL | 2.0 | 2G |
| Redis | 0.5 | 512M |
| RabbitMQ | 0.5 | 512M |

**Verification:** `docker stats` → confirm containers respect limits under load.

---

### Priority 4 — CORS from Environment Variable (15 minutes)

**File to change:**
- `trade-engine/TradeEngine.Api/Extensions/ServiceCollectionExtensions.cs` — lines 147–156

**Current code (approximate):**
```csharp
options.AddPolicy("AllowFrontend", policy =>
    policy.WithOrigins("http://localhost:3000")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials());
```

**Improved version:**
```csharp
var allowedOrigins = builder.Configuration
    .GetValue<string>("CORS_ORIGINS", "http://localhost:3000")!
    .Split(',', StringSplitOptions.RemoveEmptyEntries);

options.AddPolicy("AllowFrontend", policy =>
    policy.WithOrigins(allowedOrigins)
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials());
```

**Verification:** Set `CORS_ORIGINS=http://myfrontend.example.com` → verify requests from that origin succeed and from others are rejected with 403.

---

## 5. Suggested Thesis Chapter Structure

If you are writing a chapter on architecture and scalability, the following structure covers the most interesting ground without requiring additional implementation:

**Section: Reverse Proxy and API Gateway**
Explain the distinction between a reverse proxy (routes requests, proxies connections) and an API gateway (also handles auth offloading, rate limiting, service discovery, circuit breaking at the network layer). Describe what the platform uses (Nginx as embedded proxy, Cloudflare Tunnel for external access) and what a full API gateway would add.

**Section: Real-Time Communication and Horizontal Scaling**
Explain why WebSocket connections complicate horizontal scaling. Cover the sticky session approach vs. the shared backplane approach. Describe why the current single-node deployment sidesteps this problem and what would be required to scale out.

**Section: Message Durability and Dead-Letter Handling**
Describe the transactional outbox pattern (implemented), the RabbitMQ DLX pattern (not implemented), and the gap at the in-flight order queue boundary. Discuss exactly-once vs. at-least-once delivery semantics.

**Section: CAP Theorem Trade-offs**
The system consistently favors consistency over availability in settlement (single writer, atomic updates, optimistic concurrency). Explain this as a deliberate choice for a financial application, contrast with systems that favor availability (e.g., eventual consistency in read models), and connect to the Redis cache layer as the availability-favoring counterpart.

**Section: Future Architecture (Production Path)**
Cover: Kubernetes migration (orchestration), service mesh (network-layer policies), read replicas (database scaling), secrets management (operational security), horizontal pod autoscaling. Frame each as "this is what the next increment would look like" rather than "this is missing."
