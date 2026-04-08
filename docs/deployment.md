# Production Deployment Guide

This guide covers deploying the full Crypto Investor platform stack — including microservices, observability, and Grafana — securely on a free Oracle Cloud instance behind a Cloudflare Zero Trust tunnel.

---

## 1. Hosting Provider

The full stack (4 microservices + PostgreSQL + Redis + RabbitMQ + OTel + Prometheus + Loki + Tempo + Grafana) requires significantly more than a 1 GB free tier. The only free option with adequate resources is Oracle Cloud.

**Oracle Cloud Infrastructure (OCI) — Always Free Tier**
| Resource | Spec |
|----------|------|
| Instance type | ARM Ampere A1 Compute |
| vCPUs | 4 OCPUs |
| RAM | 24 GB |
| Storage | 200 GB block volume |
| OS | Ubuntu 22.04 LTS |

---

## 2. Server Provisioning

### 2.1 Create the Instance
1. Create a free Oracle Cloud account at cloud.oracle.com.
2. Go to **Compute → Instances → Create Instance**.
3. Select **Ampere A1** shape, allocate **4 OCPUs / 24 GB RAM**.
4. Generate and download your SSH key pair during creation.
5. SSH into the instance once it's running:
   ```bash
   ssh -i <your-private-key>.key ubuntu@<instance-public-ip>
   ```

### 2.2 Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git curl
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker  # Apply group change without logout
```

### 2.3 Configure OCI Firewall (Security Lists)
By default OCI blocks all inbound ports. You only need **port 443** open for Cloudflare traffic — everything else flows through the internal Docker network.

In the OCI Console go to **Networking → Virtual Cloud Networks → [your VCN] → Security Lists** and add:

| Direction | Protocol | Source | Dest. Port | Purpose |
|-----------|----------|--------|------------|---------|
| Ingress | TCP | 0.0.0.0/0 | 22 | SSH access |
| Ingress | TCP | 0.0.0.0/0 | 443 | Cloudflare HTTPS |

Also configure the instance-level firewall:
```bash
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
# Persist rules
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## 3. Repository Setup

Clone the repository onto the server:
```bash
git clone https://github.com/<your-org>/crypto-investor-thesis.git
cd crypto-investor-thesis
```

---

## 4. Production Configuration

Create `.env.prod` in the project root. **This file must never be committed to git.**

```env
# PostgreSQL
POSTGRES_USER=admin
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=crypto_investor_prod

# RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASS=<strong-random-password>

# Grafana (login credentials for the dashboard)
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<strong-random-password>
DOMAIN=yourdomain.com

# Cloudflare Tunnel (see Section 5)
CLOUDFLARE_TUNNEL_TOKEN=<your-tunnel-token>
```

---

## 5. Cloudflare Zero Trust Tunnel

All public traffic enters through a Cloudflare Tunnel. No ports (other than SSH) are directly exposed.

### 5.1 Create the Tunnel
1. Create a free Cloudflare account and add your domain.
2. Go to **Zero Trust → Networks → Tunnels → Create Tunnel**.
3. Select **Docker** as the environment and copy the tunnel token.
4. Paste the token into `.env.prod` as `CLOUDFLARE_TUNNEL_TOKEN`.

### 5.2 Configure Public Hostnames
In the Cloudflare tunnel dashboard, map these hostnames to internal Docker services:

| Public Hostname | Internal Service | Notes |
|-----------------|-----------------|-------|
| `app.yourdomain.com` | `http://web-client:80` | React SPA. Nginx inside proxies `/api` and `/hub` to `trade-engine:8080` |
| `grafana.yourdomain.com` | `http://grafana:3000` | Protected by Zero Trust Access policy (see 5.3) |

> **Architecture note:** A single tunnel route to `web-client:80` is sufficient for the entire platform. The nginx reverse proxy inside the web-client container forwards `/api/*` → `trade-engine:8080` and `/hub` → `trade-engine:8080` (WebSocket) over the internal Docker network. The browser never needs to know the trade-engine's address.

### 5.3 Secure Grafana with Zero Trust Access
Grafana is the only other public-facing service. Protect it so only you can access it:

1. In the Cloudflare dashboard, go to **Zero Trust → Access → Applications → Add Application**.
2. Choose **Self-hosted**, set the application domain to `grafana.yourdomain.com`.
3. Create an **Access Policy**: Action = Allow, Include = Emails → add your email address.
4. Cloudflare will require an email OTP (or Google/GitHub SSO) before serving the Grafana login page.

This means even if someone guesses your Grafana admin password, they cannot reach the login form without first passing the Zero Trust email check.

---

## 6. Initial Database Seeding

On first boot, `DatabaseSeeder` runs automatically as part of `trade-engine` startup. It applies all EF Core migrations and creates the admin user if none exists:

| Field | Value |
|-------|-------|
| Username | `Admin` |
| Password | `AdminPassword123!` |
| Wallet | 100,000,000 USDT + 500 BTC |

**Important:** Change the admin password immediately after first login via the API (`POST /api/v1/auth/register` to create your own account, then use the Admin account only for testing/seeding). The hardcoded password exists only to ensure the system is bootstrappable without manual intervention.

---

## 7. Launch the Stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Monitor startup logs to ensure all services come up:
```bash
docker compose -f docker-compose.prod.yml logs -f --tail=50
```

Check the trade-engine health endpoint:
```bash
curl https://app.yourdomain.com/api/v1/system/health
```

---

## 8. Running the k6 Load Tests

The load tests require k6 to be installed. The easiest method is Docker:

```bash
# From the project root — runs tests against the production API
docker run --rm -i \
  -e TRADE_ENGINE_URL=https://app.yourdomain.com/api \
  grafana/k6 run - < load-tests/trade-engine-load.js
```

Or against the local stack (if running docker compose locally):
```bash
docker run --rm -i \
  --add-host=host.docker.internal:host-gateway \
  grafana/k6 run - < load-tests/trade-engine-load.js
```

**What the test measures:**
- `order_insertion_latency_ms` (p95 < 100 ms) — raw throughput of the OrderMatchingWorker + Channel pipeline under 50 concurrent VUs placing LIMIT orders
- `orderbook_fetch_latency_ms` (p95 < 200 ms) — Redis read latency for the live order book immediately after MARKET order settlement
- `order_failure_rate` (< 1%) — rejection rate under concurrent load

The test automatically authenticates using the seeded Admin account and uses the correct API request shape. No manual token management is required.

---

## 9. Accessing Grafana Dashboards

Navigate to `https://grafana.yourdomain.com` (Cloudflare will prompt for your email OTP first, then Grafana login). Use the credentials from `.env.prod`.

Two dashboards are pre-provisioned:
- **Trading Overview** — order placement rate, settlement latency, SignalR connections, RabbitMQ queue depth
- **Infrastructure Health** — CPU, memory, Redis hit rate, PostgreSQL connections, Go goroutine count

---

## 10. Ongoing Maintenance

Deploy updates after pushing to GitHub:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker image prune -f  # Remove dangling images
```

Database migrations run automatically on trade-engine startup via `MigrateAsync()`. No manual `db-update` step is needed in production.

Check persistent volumes are intact after a restart:
```bash
docker volume ls | grep prod
```
