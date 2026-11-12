# ADR-0004: Region Co-Location Between Render API/Worker and Supabase Primary

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

A single POS invoice or sync push performs multiple database round-trips. Cross-region RTT (e.g., US-East API talking to EU-Central Postgres) adds 80–150 ms per query, blowing the 450 ms p95 SLO.

## Decision

Deploy `hisabche-api` and `hisabche-worker` in the exact same cloud region as the Supabase Primary PostgreSQL instance. External clients reach the API over TLS/CDN; API-to-DB traffic stays intra-region.

## Consequences

- **Positive:** Sub-2ms DB RTT; keeps p95 invoice latency well below SLO.
- **Negative:** Region migration requires moving both Render services and Supabase project together (`docs/runbooks/region-loss.md`).
