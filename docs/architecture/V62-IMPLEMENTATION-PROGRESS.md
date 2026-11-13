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

## §9 Final Verification — DONE (12 Nov 2026)

Shell renderer Vite build (one config serves both hosts: desktop `electron.vite.config.ts` and mobile
`vite.shell.config.mjs` both call `shellRendererConfig`, singleFile:false) into a temp outDir, then
`node scripts/packs/report.mjs`:

| Measure                   | Before (E1/E3)                                      | After                                                                                                                             |
| ------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Mobile entry              | 7,313,539 B single `index.html`, everything inlined | 387,920 B raw / 117,817 B gzip core entry                                                                                         |
| Desktop entry chunk       | 9,352,893 B (75% of all JS)                         | 387,920 B raw / 117,817 B gzip                                                                                                    |
| Total JS                  | 12.4 MB (desktop, 8 Nov build)                      | 7,273,438 B raw / 1,999,138 B gzip, 40 files                                                                                      |
| Locale payload per device | 2.26 MB raw (fa+af+en, all bundled)                 | one locale chunk: fa 733 KB · af 722 KB · en 509 KB raw (194/194/169 KB gzip)                                                     |
| Packs (gzip)              | —                                                   | approvals 10.8 KB · manufacturing 46.3 KB · marketplace 10.7 KB · workforce 73.9 KB · operations 452.4 KB · intelligence 526.1 KB |

Every pack is within `bundle-budgets.json`.

### Fixed during §9 (root causes, not loosened)

- `scripts/packs/report.mjs` parsed the pack id from the FILE NAME. A content hash may contain '-'
  (`pack-marketplace-v-Nxw5pK.js`), which reported a pack `marketplace-v` whose budget was never checked.
  Now it reads the chunk `name` from Vite's manifest.
- `bundle-budgets.test.ts`:
  - a budgeted pack missing from the report counted as 0 bytes (`?? 0`); it now fails;
  - with no report the test returned GREEN; it is now SKIPPED (`it.skip`, reported as skipped);
  - `REQUIRE_PACK_REPORT=1` (for CI after the build) makes a missing report a failure;
  - no `expect(x, msg)` second argument, because desktop runs this file under Jest.
  - Proven: no report → "1 skipped"; REQUIRE_PACK_REPORT=1 without a report → fails.
- `packages/api/src/hooks/guide-progress.ts`: an implicit `any` under apps/mobile's tsconfig (pre-V62) is typed.
- `packages/app-shell/src/features/settings/settings-page.tsx`: dead imports `LogOut`, `Button` (pre-V62) removed.
- The generated `capability-matrix.csv` and the industry coverage table were regenerated (stale only because
  the uncommitted V63 work moved lines in `oauth.routes.ts`).

### Results (sequential, TMP=.esbuild-tmp)

| Package                                     | tsc                                                                                                      | tests                                                                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| validation                                  | 0                                                                                                        | 1004 total; the 3 earlier reds are fixed (2 generated docs regenerated; architecture-boundaries passes alone, load-only)                                                           |
| api                                         | 0                                                                                                        | 293/293                                                                                                                                                                            |
| store, i18n, app-bridge, local-engine, sync | 0                                                                                                        | i18n 29/29 · app-bridge 35/35 · local-engine 565/565 · sync 40/40                                                                                                                  |
| ui                                          | 0                                                                                                        | 2699 passed, 2 skipped                                                                                                                                                             |
| app-shell                                   | 0                                                                                                        | runs inside desktop Jest                                                                                                                                                           |
| apps/desktop                                | 0                                                                                                        | Jest 335/335 (incl. bundle-budgets)                                                                                                                                                |
| apps/mobile                                 | 0                                                                                                        | Jest 220/220                                                                                                                                                                       |
| apps/web, apps/admin                        | 0                                                                                                        | —                                                                                                                                                                                  |
| backend                                     | 3 errors, all in **uncommitted V63 files** (`admin-rate-limit.middleware.ts`, `runtime/test-runtime.ts`) | 27 failures, all in **V63 work in progress** (admin route chain, rate limit, AI, blog/cms/oauth/market guards, monitoring, job guard). The V62 sync tests (`sync-scope-http`) pass |
| admin (vitest)                              | —                                                                                                        | 3 failures in `admin-redesign.guard`, from V63 WIP screens                                                                                                                         |
| ESLint (41 V62 files + edits)               | 0 errors, 0 warnings                                                                                     |                                                                                                                                                                                    |

- pg tests (`sync-scope-01.pg.test.ts`): BLOCKED; `initdb.exe` is missing on this machine.
- No electron-builder, Gradle, EAS or next build was run.

### Status

- V62 code: IMPLEMENTED_NOT_LIVE_VERIFIED.
- sync-scope-01: Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
- Pack delivery over the network: flag OFF (owner actions pending).
