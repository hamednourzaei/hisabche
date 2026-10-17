# SESSION CACHE — 16 Oct 2026 — the warehouse map (نقشه انبار)

The spec, the acceptance list and the limitations: **`.claude/warehouse-map/00-SPEC.md`**.
This file is the review aid: what changed, what was measured, what bit us.

Status: `IMPLEMENTED_NOT_LIVE_VERIFIED`. Nothing committed, nothing pushed.
The migration has not been run anywhere; no DDL touched the live database.

---

## 1. What was delivered

| Layer | File | What |
|---|---|---|
| migration | `docs/warehouse-map-01-migration.sql` | `storage_locations`, `storage_location_placements`, trigger `storage_locations_shape()`, function `storage_place_stock()`, RLS + revoke/grant |
| VERIFY | `docs/VERIFY-warehouse-map-01.sql` | 17 read-only checks |
| pg test | `backend/src/__tests__/warehouse-map-01.pg.test.ts` | runs the file **twice** on embedded Postgres + every rule's refuse/allow write |
| domain | `backend/src/services/inventory/warehouse-map.domain.ts` | bands (`reorder.domain` constants), `stockValue`/`priceOf`, `intensityClass`, `costVisible` redaction |
| service | `backend/src/services/inventory/warehouse-map.service.ts` | read + 3 writes, `assertMayUseWarehouse`, `migrated:false` payload when the tables are absent |
| routes | `backend/src/routes/warehouse-map.routes.ts` | 4 routes; registered in `backend/src/index.ts` |
| guards | `backend/src/utils/concurrency-safety-map.ts` | 3 entries |
| validation | `packages/validation/src/schemas/storage-location.schema.ts` | create/update/place schemas |
| hooks | `packages/api/src/hooks/warehouse-map.ts` | `useWarehouseMap`, `useCreateStorageLocation`, `useUpdateStorageLocation`, `usePlaceStock` |
| UI | `packages/ui/src/components/ui/warehouse/map/` | `map-filtering.ts` (pure), `warehouse-map-canvas.tsx`, `warehouse-location-drawer.tsx`, `location-dialog.tsx`, `warehouse-map-panels.tsx`, `warehouse-map-view.tsx`, `containers/warehouse-map-container.tsx` |
| hub | `…/warehouse/containers/warehouse-tabs-container.tsx` | 5th section `map` (lazy, mounts nothing itself) |
| entry | `…/warehouse/warehouse-view.tsx` + `…/containers/Warehouse-container.tsx` | «مشاهده نقشه انبار» → `/warehouse?view=map&mapWarehouse=<id>` |
| i18n | `packages/i18n/messages/{fa,af,en}/common.json` | 139 `warehouseMap.*` keys + `warehouseHub.sections.map` |

## 2. Numbers actually measured

| Command (in the package) | Result |
|---|---|
| `packages/ui` `npx vitest run` | `Test Files 5 failed \| 151 passed \| 1 skipped (157)` — the 6 failed tests are the known-red list, see §5 |
| `packages/ui` `npx tsc --noEmit` | exit 0 |
| `packages/ui` `npx eslint <every changed file>` | 0 errors |
| `packages/ui` map tests | filtering 23 · canvas 10 · view 10 = **43 passed** |
| `backend` map tests | domain 21 · http 19 · pg 10 = **50 passed** |
| `backend` `npx tsc --noEmit` | exit 0 |
| `packages/api` `npx tsc --noEmit` | exit 0 |
| `apps/web` `npx tsc --noEmit` | exit 0 |
| `packages/app-shell` `npx tsc --noEmit` | exit 0 |
| `packages/i18n` keys | 139 per locale, all three locales, `warehouseHub.sections.map` present |
| browser | **اجرا نشد** — see §6 |

## 3. Two guards proved by undoing them

1. `summarizeLocations` returning `value: sum(...)` instead of `costVisible ? … : null`
   → `warehouse-map-filtering.test.ts` «leaves money null when the reader may not see
   cost — never 0» went red. Restored.
2. The view computing the KPI over `locations` instead of `selection.visible`
   → two view tests («the header follows the floor») went red. Restored.

## 4. Bugs hit while building (each was real, each has a test or a reason)

1. **«Never sold» was lost by an aggregate.** `deadCapital`'s `oldestDays` reduced over
   products and returned `null` for «never sold», but the NEXT product with a number
   overwrote it — and the number itself was the wrong statistic (the LARGEST gap
   instead of the SMALLEST). Now: `quietDays` = min of the products that sold,
   `neverSoldCount` = how many never did, and both are on screen.
2. **`can()` returns `boolean | undefined`.** `const canConfigure = capabilities.can(…)`
   did not compile against a `boolean` prop — which is the compiler pointing at a real
   hole: «capability not read yet» must be **no**, so every gate is `can(…) === true`.
3. **`productsWithoutCost` under redaction.** Computed from `unitCost === null`, it
   counted *every* product once costs were hidden. The server reports 0 there, and so
   does the UI now — the number never exists in a wrong form.
4. **`?mapWarehouse=` exists because `?warehouse=` is wiped.** `useHubSection`'s
   `STOCK_SECTION_CLEARS` deletes the hub's `warehouse` param when the section changes,
   so a map that stored its warehouse in the shared param lost it on the way in.
5. **A token that does not exist**: `hsl(var(--warning-fg,var(--color-warning)))` —
   `--warning-fg` is nowhere in the theme; `var()` fallbacks hide that. Now
   `hsl(var(--color-warning))`.
6. **A relative path one level too deep**: from `warehouse/containers/`,
   `'../../map/…'` points outside the folder. tsc caught it, not the browser.
7. **Props added to a type and one call site but not to the destructuring** of
   `WarehouseView` — again tsc (`Cannot find name 'mapActionLabel'`).
8. **Re-serialising a catalog rewrites lines nobody asked about.** `JSON.stringify`
   put the one-line `weekdaysShort` array on seven lines; the i18n script now splices
   text in, and verifies a round-trip before writing. The anchor `"deadStock": "…"`
   also occurs **twice** per catalog (another namespace) — the anchor carries its six
   spaces of indentation.
9. **testing-library never cleans up with `globals: false`.** Every `render()` in the
   file stacked, and `getByRole` found the same shelf four times. `afterEach(cleanup)`
   is now in both component tests.
10. **`select.tsx` calls `useTranslations()` internally.** A bare jsdom render of the
    view therefore throws — the view test mocks `next-intl` with **the real Persian
    catalog**, not a dictionary of keys.
11. **Dead exports removed from the domain**: `MAP_METRICS` / `DEFAULT_MAP_METRIC` /
    `MapMetric`. What the floor is coloured BY is a screen decision; the server always
    sends the band and both classes so colour can change without a round trip.
12. **A drive-by one-character change, in a comment nobody asked about.** An edit made
    beside `/** «انتقال موجودی» — … */` matched fuzzily (the tool tolerates typographic
    variants) and wrote its own plain hyphen back: the em dash of a line that has
    nothing to do with the map became `-`. Caught by reading the **full** diff of every
    pre-existing file instead of trusting the insertions count. Restored, and the same
    audit was run over all ten edited pre-existing files — this was the only one.
13. **Prettier drift, and how to format without a drive-by reformat.** 15 of the new
    files were not prettier-clean. Two of the flagged files were **pre-existing** ones I
    had edited. Before touching them, a throwaway node script asked prettier's own API
    whether the **HEAD** version was already unformatted: both were clean, so the drift
    was mine and `--write` was safe. `git diff --stat` then showed `warehouse-view.tsx`
    at `+37 −2` — my insertions only, no reformat of the rest of the file.
    (`npx prettier --check` on an array of paths in PowerShell passes them as ONE
    argument; pass quoted globs or a single path per argument.)

## 5. Known-red accounting (measured today, `packages/ui`)

Red, and **not** from this work: `customers-hub` (1) · `personal-view` (1) ·
`sales-funnel` (1) · `sales-hub` (1) · `warehouse-hub` (2 — «uses the ONE tab bar…» and
«mounts the containers… fetches nothing itself»; the hub calls `useHubSection(…)`, which
the guard's allow-list predates).

⚠️ **`i18n-keys-exist` was listed in `AGENTS.md` as known-red (3) and is now GREEN
(5/5).** The three failures were missing keys, and this session's keys landed. The
known-red list in `AGENTS.md` deserves a re-measure — I did not touch it.

`warehouse-hub.test.ts` needed one honest update: `STOCK_SECTIONS` is pinned, and the
hub now carries a fifth section. `business-os-screens-keys.test.ts` gained
`warehouseHub.sections.map` in its `dynamic` list.

## 6. What was not done, and why

- **No live run.** `docs/warehouse-map-01-migration.sql` is a file for a human. The map
  on an un-migrated database is not an error: the API answers `migrated: false` and the
  screen says the script has to be run.
- **Browser verification: not performed.** `apps/web` serves on 3039 (`next dev
  -p 3039`) and nothing was listening; port 3000 belongs to a **different app** (a
  storefront — «پِستینو»), so its tab was closed again without touching it. The map also
  needs the migration *and* a logged-in session. The states are covered instead by the
  jsdom render tests in `warehouse-map-view.test.tsx` (10 tests, real Persian text).
- **No layout editor, no 3D, no drag-and-drop** — the owner's decision: the map is
  «where are my goods», not a CAD tool. A place is a small dialog, not a canvas.
- **Mobile (Expo) has no map**: `apps/mobile` cannot import `packages/ui`.
- **Capacity is not a heat metric**: it is only known where somebody typed it, so it is
  shown in the drawer of that one location instead of colouring the floor.
- **The map is not synced offline** (`offline-contract`), it is never cached
  (`staleTime: 0`), and a placement is not a stock movement — hence no
  `invalidateMoneyCaches`.

## 7. Pre-existing defects found on the way — reported, NOT fixed (out of scope)

1. **Cost is declared manager-only and then shown to everybody on the same hub.**
   `authorization.domain.ts` declares `{ field: 'buyPrice', minRole: 'manager', mode: 'read' }`,
   and the map follows it (a seller gets `value: null` + «ارزش برای نقش شما نمایش داده
   نمیشود»). But `warehouse-product-list.tsx` (the «کالاها» section of the SAME hub)
   renders a «قیمت خرید» column and a `quantity × buyPrice` value column with no
   capability gate at all, fed by `/api/warehouses/:id/detail` (floor: `inventory.read`
   = seller) — `warehouse-summary.domain.ts` maps `buy_price` into the response.
   Two screens, one rule, two answers. **Decision needed from the owner** (the map is
   the side that matches the declared policy; I did not touch the list).
   Evidence: source reading of the three files above — **not** reproduced against a
   live database. Registered as BUG-124.
2. **`data.code` is not the only shape.** A route's own `fail()` sends
   `{ error, code }`, but anything thrown in a **preHandler** (a capability or
   tenancy refusal) reaches the global handler in `backend/src/index.ts`, which sends
   `{ statusCode, error: err.name, message, path, method }` — no `code` field. A
   screen reading only `response.data.code` (as `warehouse-dialogs.tsx` does) shows a
   generic message for exactly the permission refusals. The map's own `serverCode()`
   reads `code` then `message`. Source reading, not reproduced.
3. `sales-hub.test.ts`'s «mounts the containers…» failure is the same pattern as the
   warehouse hub's — a pre-existing guard/allow-list drift (it expects the hub to call
   `useHubSection(STOCK_SECTIONS, …)` and to call no component-shaped hook itself).

## 8. For the reviewer — read in this order

1. `docs/warehouse-map-01-migration.sql` — the rules the database enforces.
2. `backend/src/services/inventory/warehouse-map.domain.ts` — bands, value, redaction.
3. `backend/src/__tests__/warehouse-map-01.pg.test.ts` — migration run twice + refusals.
4. `packages/ui/src/components/ui/warehouse/map/map-filtering.ts` — every screen decision.
5. `packages/ui/src/components/ui/warehouse/map/warehouse-map-view.tsx` — the states.
6. `.claude/warehouse-map/00-SPEC.md` — the spec and the acceptance checklist.

## 9. Waiting for a human

| Item | Status |
|---|---|
| `docs/warehouse-map-01-migration.sql` + `docs/VERIFY-warehouse-map-01.sql` (17 checks) | Post-migration verification query generated — **PENDING HUMAN CONFIRMATION** |
| after running it: open انبار → «مشاهده نقشه انبار» on the built app | needs backend deployed before web |
| re-measure the known-red list in `AGENTS.md` (`i18n-keys-exist` is green now) | for the owner |

## 10. The commit that would not pass — 7 errors in `hisabche-promo-reel` (fixed at the owner's request)

The owner's `git commit` failed in `lint-staged`. All 7 errors were in the motion-studio
scripts — **not** in the map — and every one was a real defect:

| File | Error | Fix |
|---|---|---|
| `scripts/export-mp4.mjs` | `document` / `window` undefined (334, 337, 342) | the callbacks are serialised and run **in the page**; written as `globalThis.document` / `globalThis.__SEEK_REEL` — the page's `globalThis` **is** its window, and the Node-side linter now sees a declared global |
| `scripts/export-mp4.mjs` | `no-empty` on `} catch {}` (464) | the block now says why it is empty: a malformed alignment file is not fatal |
| `scripts/visual-qa.mjs` | `document` undefined (151) | `globalThis.document.fonts.ready` |
| `scripts/new-reels.mjs` | `fs` and `ROOT` unused (14, 19) | both dead (with `__dirname` and `fileURLToPath`) — removed |

**No `eslint-disable` anywhere** — the errors were removed, not silenced. After the fix
`npx eslint hisabche-promo-reel` → **0 errors, 6 warnings** (the hook only fails on errors),
and `prettier --check` on the three files → clean.

⚠️ **The lesson that cost a round trip: `lint-staged` lints the STAGED content.** Fixing the
files in the working tree is invisible to the hook; it re-ran on the old staged bytes, failed
again, and its failure path restored the staged content — **wiping the fix from the working
tree**. `git add` the three files (done here) *before* committing, or run `git add .` first.

⚠️ **Second lesson: `git diff -w` is not a "formatting only" proof.** Prettier also changes
punctuation (trailing commas, arrow parentheses), so a stripped-whitespace comparison still
reports a difference. Formatting changes deserve a fresh test run, not a clever diff.

