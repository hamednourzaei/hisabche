# V62 Implementation Progress

- **Started:** 2026-11-12
- **HEAD:** `0b68fe4e`

## Slices

- [x] **Slice 0 (Phase 0):** Re-measured E1–E9 and wrote `docs/architecture/packs/V62-PREFLIGHT.md` (including 50-item table).
- [x] **Slice 1 (§4.1):** Pack registry (`packages/validation/src/schemas/feature-packs.ts`), `ENGINES[*].pack` (`business-capabilities.ts`), `packages/validation/src/index.ts`, `packages/validation/src/__tests__/feature-packs.test.ts`.
- [x] **Slice 2 (§4.2 steps 1–2):** `sideEffects` in `packages/ui/package.json` & `packages/api/package.json`, deep imports in `providers.tsx` & `route-error.tsx`, guards (`side-effects-declared.test.ts`, `no-eager-barrel.test.ts`).
- [x] **Slice 3 (§4.2 step 5):** Active-locale dynamic import in `packages/i18n/src/messages.ts`, `messages-static.ts` for `apps/web` / error fallbacks, shell-only namespace filter (`SHELL_EXCLUDED_NAMESPACES`), `locale-split.test.ts`.
- [x] **Slice 4 (§4.2 steps 3–4, 6):** `scripts/packs/emit-pack-map.mjs`, `packages/app-shell/pack-map.generated.json`, `singleFile: false` in `apps/mobile/vite.shell.config.mjs`, `manualChunks` + `build.manifest: true` in `packages/app-shell/vite.shell.mjs`, idle prefetch (`prefetch.ts`) wired into `app.tsx`.
- [x] **Slice 5 (§4.6):** Module-scoped sync (`docs/sync-scope-01-migration.sql`, `docs/VERIFY-sync-scope-01.sql`, `sync-scope-01.pg.test.ts`, `sync-scope-http.test.ts`, `sync.service.ts` v2+v1 fallback & explicit column lists, `sync.routes.ts`, `sync-engine.ts`, pure backfill planner `sync-backfill.ts` + `sync-backfill.test.ts`).
- [x] **Slice 6 (§4.7):** Load checks (`pack-gate.tsx` + route gating in `app.tsx`, `pack-zero-requests.test.tsx`).
- [x] **Slice 7 (§4.3):** Bundle budgets (`scripts/packs/report.mjs`, `packages/app-shell/bundle-budgets.json`, `bundle-budgets.test.ts`).
- [x] **Slice 8 (§4.4):** Shared pack store (`packages/app-bridge/src/packs/{manifest,plan,verify,store}.ts` + `packs-store.test.ts`), desktop `hisabche-app://` protocol + store adapter (`apps/desktop/electron/main/{protocol,packs}.ts`, `window.ts`, `index.ts`, `pack-protocol.test.ts`), `SPIKE-mobile-loader.md`. Flag defaults OFF (`packs.delivery=off`, `packs.installer=full`).
- [x] **Slice 9 (§4.5):** Selection UX (`packages/ui/src/components/ui/settings/device-modules-panel.tsx`, `composition-plan-summary.tsx`, `packages/app-shell/src/features/settings/settings-page.tsx`, `packs.*` i18n keys in `fa/af/en`, `device-modules-panel.test.tsx`).
- [x] **Slice 10 (§5):** Tooling & Docs (`scripts/packs/sign-manifest.mjs`, `scripts/packs/publish.md`, `docs/architecture/packs/00-OVERVIEW.md`, `ADR-0001`, `ADR-0002`, `ADR-0003`, `RUNBOOK-withdraw-a-pack.md`, failure-mode table).

## Cold-Start & Gated-Route Request-Count Method (§4.7)

1. **Automated test verification (`packages/app-shell/src/__tests__/pack-zero-requests.test.tsx`):**
   - Mounts a gated pack route (e.g. `manufacturing` or `operations`) inside `PackRouteGate` when `packs.delivery=on` and the pack is not installed (`not_installed`), or missing from the workspace plan (`not_in_plan`), or disallowed by user role (`not_allowed`).
   - Attaches a spy / counter on the React Query `QueryClient` fetch/query cache and `apiClient` transport; asserts **0 network requests** are dispatched because `PackRouteGate` short-circuits to `PackRouteNotice` before mounting the lazy pack container or firing its hooks.
2. **Manual cold-start measurement (owner runtime check when running Desktop/Mobile dev shell):**
   - Clear IndexedDB / SQLite cache -> boot Desktop or Mobile shell on default `core` route (`/`) -> inspect DevTools Network tab + React Query DevTools -> verify only core bootstrap requests execute (zero chunk loads or queries for `manufacturing`, `workforce`, `intelligence`, `approvals`, `marketplace`, and `sync` requests include only `syncEntitiesForPacks(installedPacks)`).

## Guard Decision Log (Lesson 0 #4)

- `singleFile: true` in `apps/mobile/vite.shell.config.mjs` was intentionally replaced with `singleFile: false` because Android already loads `file:///android_asset/shell/index.html` outside Metro, and removing `singleFile` enables Rollup chunk splitting (`pack-*`, `locale-*`) instead of parsing a monolithic 7.31 MB HTML bundle.
- `error-boundary-escape.test.ts` updated from `/from '@hisabche\/ui'/` to `/from '@hisabche\/ui(?:\/[^']+)?'/` to match V62 Slice 2's deep subpath import (`@hisabche/ui/error-fallback`) while keeping shared fallback enforcement.
- `marketplace-screens.test.ts` updated to assert `marketplace` renders `<MarketplacePage />` inside `<PackRouteGate packId="marketplace">` and `gated('/marketplace', '/settings', ...)` in `app.tsx` (V62 Slice 6).
- `product-images-panel.test.ts` updated to assert `index.ts` calls `buildRendererCsp(isPackDeliveryEnabled())` and `protocol.ts` declares the strict `img-src ... https:;` and `script-src ...;` rules (V62 Slice 8).

## NEEDS_OWNER_DECISION Log

- `packs.delivery` defaults to `'off'`; `packs.installer` defaults to `'full'`; Wi-Fi-only download defaults to `true`.
- CDN bucket/domain, Ed25519 signing key pair, Play/Apple WebView JS policy confirmation, `sync-scope-01` + staging `EXPLAIN`, and mobile real-device spike are owner actions.

NEXT: §9 Final Verification (sequential builds -> `scripts/packs/report.mjs` -> `bundle-budgets.json` -> `tsc` -> `vitest` -> `jest` -> `eslint` -> Persian final report).
