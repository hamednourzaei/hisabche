# UNIVERSAL BUSINESS CORE — DEPENDENCIES (M0 output)

**Date**: 2026-11-01 · produced from every `package.json` under `packages/`, `apps/` and `backend/`
(`@hisabche/*` entries of `dependencies`, `devDependencies`, `peerDependencies`).

## 1. Package dependency graph (as it is, not as designed)

| Package                                                     | Depends on                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `validation` (shared domain core)                           | `formatting`                                                                                                                           |
| `formatting`                                                | —                                                                                                                                      |
| `app-bridge` (local schema, outbox row builder)             | —                                                                                                                                      |
| `sync`                                                      | `validation`                                                                                                                           |
| `local-engine` (SQLite adapter)                             | `app-bridge`, `formatting`, `validation`                                                                                               |
| `api` (React Query hooks, HTTP client, local/remote switch) | `auth-core`, `validation`                                                                                                              |
| `store`                                                     | `api`, `auth`, `auth-core`, `formatting`, `validation`                                                                                 |
| `ui-contract`                                               | `design-tokens`                                                                                                                        |
| `ui` (all shared screens)                                   | `api`, `formatting`, `store`, `ui-contract`, `validation`                                                                              |
| `app-shell` (sync engine host, routes)                      | `api`, `app-bridge`, `auth-core`, `formatting`, `i18n`, `store`, `sync`, `ui`, `validation`                                            |
| `backend`                                                   | `formatting`, `sync`, `validation`                                                                                                     |
| `apps/web`                                                  | `api`, `formatting`, `i18n`, `store`, `ui`, `ui-contract`, `validation` — **no `local-engine`, no `app-bridge`**                       |
| `apps/desktop`                                              | `api`, `app-bridge`, `app-shell`, `auth-core`, `formatting`, `i18n`, `local-engine`, `store`, `ui`, `validation`                       |
| `apps/mobile`                                               | `api`, `app-bridge`, `app-shell`, `auth-core`, `formatting`, `i18n`, `local-engine`, `mobile-ui`, `store`, `ui-contract`, `validation` |
| `apps/admin`                                                | `api`, `auth`, `auth-core`, `formatting`, `i18n`, `store`, `ui`, `validation`                                                          |

```text
                 validation ──► formatting
                  ▲    ▲   ▲
        ┌─────────┘    │   └──────────┐
   local-engine      backend          sync
        ▲  ▲                           ▲
 app-bridge │                          │
        │   └─────── apps/desktop, apps/mobile ◄── app-shell ◄─┘
        │                 ▲   ▲                       ▲
        └─────────────────┘   └── ui, api, store ─────┘
                       apps/web ──► ui, api, store   (no local adapter)
```

## 2. Properties that hold (measured)

- `validation` has no inbound business logic from any adapter: `packages/validation/src/__tests__/architecture-boundaries.test.ts` — 4/4 pass; no import of
  `ui`, `api`, `app-shell`, `local-engine`, `app-bridge`, `backend`, `react`, `electron`, `react-native`, `better-sqlite3`, `@supabase/supabase-js`.
- `backend` and `local-engine` are siblings: neither imports the other. They meet only in `validation`.
- The three user-facing apps contain no business code (audit F-06).

## 3. Properties that are false or unproven

- The two adapters meet in `validation` but **do not call the same functions** for most flows (audit F-03).
- `local-engine` does not depend on `sync`; the sync engine lives in `packages/app-shell/src/features/sync/sync-engine.ts`. The _routing_
  decision (`routeFor`, `ENDPOINT_BY_ENTITY`) is therefore app-shell code, not a shared package.
- `apps/web` cannot execute offline (no adapter) — platform parity for "Web offline" is a missing capability, not a test gap.

## 4. Slice dependency order (milestones in `UNIVERSAL-BUSINESS-DESIGN.md` §6)

```text
OD-1, OD-2 (owner)
   │
   ├─► M1.6 envelope/lease decision
   ├─► M1.1 returns parity ──► (golden vectors for returns)
   ├─► M1.2 period lock ─┐
   ├─► M1.3 allocation   ├─► M1.5 capability catalogue guard
   └─► M1.4 transfers  ──┘
                │
                ▼
          M2 offering_type ──► M3 package credit ──► M4 service delivery
                │                    │
                │                    └──► M5 refund / deferred revenue
                ▼
          M6 manufacturing / recurring / projects (-lite)
                ▼
          M7 reporting + integrations ──► M8 hardening + real-device verification
```

Hard dependencies: nothing in M2+ may start until M1.1 is green (a service line that returns must not corrupt stock);
M5 needs OD-1 (offline cash refunds) decided; M3 needs `accounts.role` extension planned with its four companion files.

## 5. External blockers recorded by M0

| Blocker                                                   | Effect                                                                                             | Owner action                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `postgres.exe` quarantined on this machine                | `*.pg.test.ts` cannot run locally; PGlite (real Postgres engine, WASM) used instead for SQL proofs | run the `*.pg.test.ts` suites in CI or on a machine with the binary |
| No physical Windows/Android run in this session           | platform cells stay `IMPLEMENTED_NOT_LIVE_VERIFIED`                                                | device/emulator session                                             |
| Migrations 03, 04, 05 (returns) not yet run on a database | production behaviour of the new return core unverified                                             | run, then send the VERIFY output                                    |
