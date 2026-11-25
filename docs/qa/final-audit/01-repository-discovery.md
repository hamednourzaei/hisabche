# 01 — Repository Discovery & QA-REGISTRY Inventory

> **Generated:** 2026-11-25T12:39:55.083Z
> **Generator:** `scripts/qa/generate-qa-registry.mjs` (zero duplicate core logic; aggregated directly from codebase)
> **Standard:** ISO/IEC/IEEE 29119 + ISO/IEC/IEEE 12207

## 1. Monorepo Topology

- **Packages (18):** `packages/analytics`, `packages/api`, `packages/app-bridge`, `packages/app-shell`, `packages/auth`, `packages/auth-core`, `packages/config`, `packages/db-schema`, `packages/design-tokens`, `packages/formatting`, `packages/i18n`, `packages/local-engine`, `packages/mobile-ui`, `packages/store`, `packages/sync`, `packages/ui`, `packages/ui-contract`, `packages/validation`
- **Applications (4):** `apps/admin`, `apps/desktop`, `apps/mobile`, `apps/web`

## 2. Quantitative Discovery Summary (Real File & Registry Counts)

| Artifact Category                            | Count                          | Authoritative Source                                                  |
| -------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| Core Engines (`ENGINE-WIRING.csv`)           | 21                             | `docs/architecture/universal-core/ENGINE-WIRING.csv`                  |
| Tracked Capabilities (`ENGINE-WIRING.csv`)   | 53                             | `docs/architecture/universal-core/ENGINE-WIRING.csv`                  |
| Registered Industries                        | 67                             | `docs/architecture/industry/sellable-industries.json`                 |
| Backend Route Modules (`*.routes.ts`)        | 129                            | `backend/src/routes/`                                                 |
| Backend API Endpoints                        | 1067                           | `docs/architecture/CONSUMER-REGISTRY.json`                            |
| Backend Service Files                        | 374                            | `backend/src/services/`                                               |
| Backend Unit/Integration Test Files          | 495                            | `backend/src/__tests__/`                                              |
| Backend Postgres Test Files (`*.pg.test.ts`) | 190                            | `backend/src/__tests__/*.pg.test.ts` (Windows local `initdb` blocked) |
| Local-Engine Offline Route Files             | 56                             | `packages/local-engine/src/routes/`                                   |
| Client API Hook Files / Exported Hooks       | 106 / 734                      | `packages/api/src/hooks/`                                             |
| Frontend Routes (Web / Admin / App-Shell)    | 67 / 27 / 0                    | `apps/web`, `apps/admin`, `packages/app-shell/src/app/app.tsx`        |
| Offline Matrix Endpoint Rows                 | 697                            | `docs/architecture/capability-matrix.csv`                             |
| Database Migrations (`docs/*-migration.sql`) | 310 (190 VERIFY, 200 PG tests) | `docs/MIGRATIONS-REGISTRY.json`                                       |

## 3. Generated QA-REGISTRY Files

- `docs/qa/final-audit/02-complete-capability-inventory.csv` (74 rows)
- `docs/qa/final-audit/05-route-api-hook-coverage.csv` (1895 rows: 1067 API + 734 Hooks + 94 UI routes)
- `docs/qa/final-audit/19-international-standards-mapping.csv` (24 standards requirements)
