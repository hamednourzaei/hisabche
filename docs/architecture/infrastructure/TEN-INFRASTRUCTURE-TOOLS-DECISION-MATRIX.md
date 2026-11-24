# HISABCHE V75 — TEN INFRASTRUCTURE TOOLS DECISION MATRIX

## Comparative Engineering Evaluation & Reverse Proxy Architecture Analysis

**Target System:** Hisabche ERP (Web, Electron Desktop, Android, Fastify API, PostgreSQL)  
**Evaluation Date:** November 2026  
**Document Status:** CANONICAL ARCHITECTURAL SPECIFICATION (`docs/architecture/infrastructure/`)

---

## 1. Executive Summary & Operating Context

Hisabche operates in environments characterized by extreme operational constraints:

1. **Low-Resource Edge Deployments:** Windows/Linux desktop POS terminals in Kabul, Herat, Mazar-i-Sharif, and regional hubs, often running on Celeron / Core-i3 dual-core CPUs with 2GB–4GB RAM.
2. **Unstable Network & Power Infrastructure:** 2G/3G connections with high packet loss (5%–15%), severe latency jitter (150ms–2000ms), and sudden drops requiring robust WebSocket keepalive and reconnection resilience.
3. **Zero Data Loss & Financial Invariants:** Integer minor-unit ledger postings, strict multi-tenancy (`workspace_id`), and durable offline queue replay.
4. **Autonomous Infrastructure Control:** Admin panel toggleability for edge rate limiting, proxy routing, cache bypass, and emergency maintenance.

To identify the optimal reverse proxy and edge routing infrastructure, ten candidate technologies were evaluated across 11 technical dimensions.

---

## 2. The 11-Dimensional Infrastructure Decision Matrix

| Dimension                       | Nginx                                              | Caddy                                    | Traefik                            | HAProxy                        | Envoy                                  | Apache httpd                             | Kong Gateway                           | Apache APISIX                      | OpenResty                        | PgBouncer                           |
| :------------------------------ | :------------------------------------------------- | :--------------------------------------- | :--------------------------------- | :----------------------------- | :------------------------------------- | :--------------------------------------- | :------------------------------------- | :--------------------------------- | :------------------------------- | :---------------------------------- |
| **1. Primary Role**             | Reverse Proxy / Web Server                         | Automated HTTPS Reverse Proxy            | Cloud-Native Ingress Proxy         | High-Perf L4/L7 Load Balancer  | Service Mesh / Edge Proxy              | Traditional Multi-Process Web Server     | API Gateway (Lua/Nginx)                | Dynamic API Gateway (etcd)         | Programmable Proxy (Lua)         | PostgreSQL Connection Pooler        |
| **2. Baseline RAM Footprint**   | **2 MB – 15 MB** (Ultra-light)                     | 35 MB – 80 MB (Go runtime)               | 40 MB – 110 MB (Go runtime)        | **3 MB – 12 MB** (Ultra-light) | 60 MB – 200 MB (C++ heap)              | 45 MB – 180 MB (Prefork/Worker)          | 180 MB – 450 MB (OpenResty+DB)         | 120 MB – 320 MB (LuaJIT+etcd)      | 30 MB – 90 MB (LuaJIT)           | **2 MB – 8 MB** (Dedicated DB Pool) |
| **3. POS / Edge Viability**     | **EXCELLENT**                                      | GOOD                                     | MODERATE                           | EXCELLENT                      | POOR                                   | MODERATE                                 | UNVIABLE                               | UNVIABLE                           | GOOD                             | **ESSENTIAL (for DB)**              |
| **4. Protocol Support**         | HTTP/1.1, HTTP/2, HTTP/3, WS, gRPC                 | HTTP/1.1, HTTP/2, HTTP/3, WS, gRPC       | HTTP/1.1, HTTP/2, HTTP/3, WS, gRPC | HTTP/1.1, HTTP/2, WS, TCP      | HTTP/1.1, HTTP/2, HTTP/3, WS, gRPC     | HTTP/1.1, HTTP/2, WS (w/ proxy_wstunnel) | HTTP/1.1, HTTP/2, WS, gRPC             | HTTP/1.1, HTTP/2, HTTP/3, WS, gRPC | HTTP/1.1, HTTP/2, WS, gRPC       | PostgreSQL Wire Protocol v3         |
| **5. Latency Overhead (p99)**   | **< 0.4 ms**                                       | ~1.1 ms                                  | ~1.8 ms                            | **< 0.3 ms**                   | ~0.9 ms                                | ~3.5 ms                                  | ~2.4 ms                                | ~1.6 ms                            | ~0.7 ms                          | **< 0.2 ms** (Tx pool)              |
| **6. Zero-Downtime Hot Reload** | **YES** (`nginx -s reload`, master-worker)         | YES (API reload)                         | YES (Dynamic providers)            | **YES** (`haproxy -sf`)        | YES (xDS dynamic APIs)                 | Graceful restart (`graceful`)            | YES (Declarative / DB)                 | YES (Dynamic etcd sync)            | YES (HUP reload)                 | YES (`RELOAD` command)              |
| **7. WebSocket Resilience**     | Native `map $http_upgrade`, streaming              | Built-in proxying                        | Automatic                          | Excellent native TCP/L7        | Filter-based                           | Requires module                          | Good                                   | Good                               | Excellent (OpenResty cosocket)   | N/A (Not an HTTP proxy)             |
| **8. Edge Rate Limiting**       | Leaky-bucket (`limit_req_zone`), zero overhead     | Caddyfile rate_limit plugin              | Middleware                         | Stick tables (highly granular) | Token bucket / Envoy filter            | `mod_ratelimit` (coarse)                 | Built-in plugin                        | Built-in plugin                    | Custom Lua                       | Client connection limits            |
| **9. TLS Termination & ACME**   | Robust TLS 1.3, OCSP, manual/certbot ACME          | Automatic native Let's Encrypt / ZeroSSL | Automatic native ACME              | Excellent TLS 1.3, SNI, OCSP   | Dynamic SDS TLS                        | `mod_ssl`                                | ACME plugin                            | ACME plugin                        | Lua ACME                         | SSL client/server termination       |
| **10. Operational Complexity**  | **LOW** (Declarative text conf, standard packages) | LOW (Minimal Caddyfile)                  | MEDIUM (Labels, Docker provider)   | MEDIUM (Strict HAProxy syntax) | **HIGH** (Complex YAML, Envoy filters) | MEDIUM (Legacy syntax)                   | HIGH (PostgreSQL/Cassandra dependency) | HIGH (etcd dependency)             | MEDIUM-HIGH (Lua scripting)      | **LOW** (Simple INI config)         |
| **11. Hisabche Verdict**        | **PRIMARY REVERSE PROXY (10/10)**                  | Secondary / Staging Alternative          | Dev/Staging Ingress                | Pure L4 Alternative            | Over-engineered for Monolith           | Obsolete for Modern Edge                 | Rejected (Memory & DB bloat)           | Rejected (Distributed overhead)    | Rejected (Unnecessary Lua layer) | **MANDATORY DB COMPANION (10/10)**  |

---

## 3. Deep Technical Analysis of Candidates

### 3.1 Candidate 1: Nginx (Optimal Primary Reverse Proxy)

- **Strengths:**
  - Microscopic RAM consumption (typically 4MB for master + 8MB for worker), making it fully runnable on 2GB RAM edge hardware alongside Electron and local SQLite.
  - Event-driven asynchronous epoll/kqueue architecture handling 50,000+ concurrent keepalive connections with deterministic sub-millisecond latency.
  - Native leaky-bucket rate limiting (`limit_req_zone`) protecting against brute-force attacks and synchronization floods without requiring external Redis or key-value stores.
  - Battle-tested master-worker process architecture enabling hitless binary upgrades and configuration reloads (`HUP` signal) without dropping active WebSocket client connections.
- **Hisabche Fit:** **10/10 — Selected as Canonical Reverse Proxy.**

### 3.2 Candidate 2: Caddy

- **Strengths:** Automated zero-configuration TLS certificate issuance via ACME; human-readable Caddyfile; memory safety from Go.
- **Weaknesses:** Higher memory consumption (40MB–80MB baseline due to Go runtime GC), which increases memory pressure on low-end POS terminals; GC pause spikes under heavy concurrent sync bursts.
- **Hisabche Fit:** 7/10 — Excellent for rapid developer environments and automated staging setups, but suboptimal for low-spec POS terminals compared to Nginx.

### 3.3 Candidate 3: Traefik

- **Strengths:** Dynamic route discovery via container labels and orchestrators; dashboard.
- **Weaknesses:** Cloud-native Kubernetes/Docker-first architecture; excessive memory overhead (60MB–120MB); does not provide standalone bare-metal elegance for single-node POS installs.
- **Hisabche Fit:** 6/10 — Viable for cloud Kubernetes deployments, unsuitable for offline-first desktop/edge installs.

### 3.4 Candidate 4: HAProxy

- **Strengths:** Industry-leading L4/L7 load-balancing throughput and sub-millisecond latency; powerful stick-table metrics.
- **Weaknesses:** Lacks static asset caching and direct file serving capabilities; requires companion web server for serving Next.js static exports or offline web bundles.
- **Hisabche Fit:** 8/10 — Outstanding for high-throughput cloud load balancing, but less versatile than Nginx for unified static file + API proxying.

### 3.5 Candidate 5: Envoy Proxy

- **Strengths:** Industry standard for large-scale microservice service meshes, distributed tracing, and xDS dynamic control planes.
- **Weaknesses:** Extremely complex configuration (thousands of lines of nested YAML); high baseline memory footprint (80MB–200MB); massive compilation times and binary footprint.
- **Hisabche Fit:** 3/10 — Drastic over-engineering for Hisabche's consolidated single-core modular monorepo.

### 3.6 Candidate 6: Apache HTTP Server

- **Strengths:** Historical ubiquity; `.htaccess` distributed configuration.
- **Weaknesses:** Legacy process/thread model (`prefork` / `worker`) consuming excessive memory under concurrent WebSocket connections; significantly slower throughput and higher latency than Nginx under load.
- **Hisabche Fit:** 4/10 — Obsolete for modern asynchronous edge API reverse proxying.

### 3.7 Candidate 7: Kong Gateway

- **Strengths:** Rich enterprise plugin ecosystem for API governance and monetization.
- **Weaknesses:** Heavyweight architecture requiring an external PostgreSQL or Cassandra database (or 200MB+ in DB-less mode); excessive memory footprint (250MB+) completely unacceptable on low-end edge devices.
- **Hisabche Fit:** 2/10 — Rejected due to database dependency and memory bloat.

### 3.8 Candidate 8: Apache APISIX

- **Strengths:** High dynamic performance powered by LuaJIT; dynamic routing without reloads.
- **Weaknesses:** Mandatory dependency on `etcd` for configuration storage; introduces distributed coordination complexity and failure modes.
- **Hisabche Fit:** 3/10 — Rejected due to `etcd` infrastructure overhead.

### 3.9 Candidate 9: OpenResty

- **Strengths:** Nginx core with embedded LuaJIT for arbitrary programmable request rewriting and in-proxy token verification.
- **Weaknesses:** Hisabche already implements pure TypeScript / Node.js zero-network JWT verification and business rules in the Fastify layer; adding Lua code creates architectural bifurcation and dual-maintenance overhead.
- **Hisabche Fit:** 5/10 — Redundant given Hisabche's existing Fastify + TypeScript application layer.

### 3.10 Candidate 10: PgBouncer (Mandatory Database Pooler)

- **Role:** Not an HTTP proxy, but an indispensable Layer 4/PostgreSQL transaction connection pooler.
- **Strengths:** Solves PostgreSQL's process-per-connection scaling bottleneck; maintains thousands of application client connections while presenting only 20–50 active connections to Postgres; negligible memory footprint (2MB–8MB).
- **Hisabche Fit:** **10/10 — Mandatory Companion for Database Layer.**

---

## 4. Architecture Recommendation & Topology

```mermaid
flowchart TD
    Client["Client Devices\n(Web, Windows Desktop, Android POS)"]

    subgraph Edge["Infrastructure Edge Layer"]
        Nginx["Nginx Reverse Proxy\n(Port 80/443)\n- TLS 1.3 Termination\n- Rate Limiting Zone\n- WebSocket Upgrade\n- Cache Bypass Header\n- Maintenance 503 Gate"]
    end

    subgraph AppServer["Application Layer"]
        Web["Next.js Web / Renderer\n(Port 3000)"]
        Backend["Fastify Backend Core\n(Port 3001)\n- Admin Infrastructure Toggles\n- Auth & RBAC Middleware\n- Tenancy Guard\n- Single Business Core"]
    end

    subgraph DataLayer["Data & Persistence Layer"]
        Pooler["PgBouncer\n(Transaction Mode, Port 6432)"]
        PrimaryPG["Primary PostgreSQL\n(Read/Write)"]
        ReplicaPG["Read Replica PostgreSQL\n(Optional Read-Pool)"]
    end

    Client -->|HTTPS / WSS| Nginx
    Nginx -->|Proxy Pass /| Web
    Nginx -->|Proxy Pass /api & /ws| Backend
    Backend -->|Pooled SQL| Pooler
    Pooler -->|Max 30 Conn| PrimaryPG
    Backend -.->|Read Only| ReplicaPG
```

---

## 5. Production Nginx Configuration Blueprint

The companion reference configuration files are located at:

- `infra/nginx/nginx.conf` — Global event loop, buffer sizes, logging formats, and rate-limiting zones.
- `infra/nginx/hisabche.conf` — Upstream server definitions, WebSocket upgrade mappings, security headers, cache bypass evaluation, and location blocks.

Both files are marked with `# NOT_DEPLOYED` to adhere to repository safety rules.
