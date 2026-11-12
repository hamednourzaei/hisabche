# ADR-0003: Redis Strictly Optional (Bounded In-Memory + Postgres Fallback)

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Managed Redis can experience transient network drops or be absent in self-hosted / low-cost deployments. Hard-failing API requests when Redis is unreachable creates an avoidable single point of failure.

## Decision

Treat Redis as an optional acceleration layer only (`cacheService`, shared rate-limit store). If `REDIS_URL` is unset or Redis errors occur, the backend automatically falls back to a bounded in-memory LRU cache and PostgreSQL-backed durability without failing business requests.

## Consequences

- **Positive:** Zero outage blast radius from Redis unavailability; simpler local and single-node deployments.
- **Negative:** Cross-instance cache invalidation is eventually consistent (bounded by short TTLs) when Redis is absent.
