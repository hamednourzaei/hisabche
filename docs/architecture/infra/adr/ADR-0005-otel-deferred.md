# ADR-0005: OpenTelemetry Collector Deferred in Favor of `/metrics` & Structured JSON Logs

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Running a sidecar OpenTelemetry collector and distributed tracing backend adds memory overhead and operational complexity on single-founder Render instances, while Fastify already emits structured JSON logs (`perf: true`, `requestId`, `dbMs`, `queries`).

## Decision

Defer full OTel trace ingestion (`@opentelemetry/*` dependencies) until traffic/instance count justifies a dedicated telemetry sink. Use the built-in authenticated `GET /metrics` endpoint (`RED` counters, `eventLoopDelayMs`, `heapUsedBytes`, `rssBytes`, `serviceMode`, `inflight`) plus structured Pino logs as the canonical observability source.

## Consequences

- **Positive:** Zero extra npm dependencies, zero collector memory overhead, immediate visibility via `/metrics` and Render logs.
- **Negative:** Cross-service distributed traces (e.g., browser -> API -> worker) rely on correlation via `X-Request-Id` / `idempotency_key` rather than OTLP spans until OTel is enabled.
