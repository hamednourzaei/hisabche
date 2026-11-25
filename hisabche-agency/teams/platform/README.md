# Team C — Platform, Offline, HA & Mobile

**Roles:**

- `Database Reliability Engineer` _(implementer — HA/DR, fencing, failover)_
- `Realtime Sync Engineer` _(implementer — local SQLite & outbox)_
- `Mobile App Builder` _(implementer — `apps/mobile`)_
- `Desktop App Engineer` _(implementer — `apps/desktop`)_
- `SRE` _(read-only — SLOs & telemetry)_
- `DevOps Automator` _(implementer — CI/Nginx/DR tooling)_
- `Performance Benchmarker` _(read-only)_
- `API Tester` _(implementer — Fastify & offline matrix parity)_

**Non-Negotiable Platform Constraints:**

- Preserve **Expo SDK 51 + React Native 0.74 + Legacy WebView (`app-shell`)**; do **not** enable RN New Architecture.
- Preserve SQLite local engine (`packages/local-engine`, `packages/sync`); never inject polling loops or Redis into offline sync.
- Enforce signed writer fencing tokens (`fencing.ts`), fail-closed replica routing (`routing.ts`), and full catalog fingerprinting (`schema-fingerprint.ts`).
