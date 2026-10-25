# ADR-003: Execution Authority per Plan (Cloud vs. Offline Edition)

## Status

Accepted

## Context

Hisabche supports two distinct commercial models and tenancy setups:

1. **Cloud Subscription Plans (`FREE`, `ONLINE_500`, `ONLINE_1000`, `ONLINE_1500`)**:
   - Multi-device, collaborative workspaces.
   - Users may work on Web, Desktop, or Mobile.
   - Offline operations (e.g. desktop/mobile offline sales) are optimistic and must sync back to the cloud.
   - Plan limits (e.g. monthly invoice quotas, user counts) are centrally enforced by the server.
2. **Offline Edition Plan (`OFFLINE`)**:
   - Completely standalone, single-workstation local database (desktop / local-engine).
   - Activated via a cryptographically stamped license code (`offline-license.ts`).
   - Zero dependency on internet connectivity or server-side authority.

## Decision

1. **Dual Authority Model Guided by Tenancy & Capability Matrix**:
   - **Offline Edition (`plan === 'OFFLINE'`)**:
     The local engine (`packages/local-engine`) holds 100% execution authority for all features marked `available` in `OFFLINE_ENDPOINT_MATRIX`. The local engine acts as the final ledger, and transactions are committed directly to SQLite. Cloud-only capabilities (marketplace, AI providers, cloud backup) are disabled in the UI via `OfflineGate`.
   - **Cloud Edition Tenants (`plan.startsWith('ONLINE_') || plan === 'FREE'`)**:
     The server remains the ultimate source of truth. When a device is online, write commands are processed through the server API. When a device is offline, it executes local-first operations using the shared domain core, persists locally to SQLite, and queues events in `sync_queue`. Upon reconnection, `POST /api/sync/push` transmits the events. The server re-runs the shared domain core to re-verify financial and business rules before committing to Postgres.
2. **Entitlement Resolution**:
   - `resolveEntitlement(workspace, feature)` in `packages/validation/src/schemas/feature-registry.ts` determines allowed features based on the active plan.
   - `packages/validation/src/schemas/offline-endpoint-matrix.ts` governs client routing:
     - `available`: local engine answers.
     - `online_required`: requires connection; rejected with `501 / onOfflineRefusal` if disconnected.
     - `not_supported`: cloud-only or non-device capability.

## Consequences

- Single-seat offline merchants enjoy full, uninterrupted local authority without cloud dependency.
- Cloud tenants benefit from resilient offline continuity without risking ledger corruption, limit evasion, or desynchronization.
- The same shared core is used in both modes, ensuring identical behavior.
