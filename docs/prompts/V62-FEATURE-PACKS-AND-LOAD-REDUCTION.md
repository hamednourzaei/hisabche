# HISABCHE V62 — FEATURE PACKS (on-demand modules) AND BACKEND/DATABASE LOAD REDUCTION

_A teacher's brief for the implementation agent. Read all of it before you change a file._

> **خلاصه برای مالک (fa):** معماری‌ای که پیشنهاد دادید نامش **«هسته + بسته‌های قابلیت بر حسب نیاز»**
> است (Dynamic Feature Delivery / On-demand Feature Packs). در کد فعلی، بزرگ‌ترین مشکل «نبودِ دانلود
> ماژول» نیست؛ این است که **تقسیم کد اصلاً کار نمی‌کند**:
>
> - موبایل یک فایل ۷٫۳ مگابایتی است که همه‌چیز را در هر بار اجرا می‌خواند.
> - در دسکتاپ ۷۵٪ کد در یک تکه است.
> - هر سه زبان در هر دستگاه بسته‌بندی شده‌اند.
>
> ترتیب درست: اول تقسیم محلی (بدون شبکه، بدون ریسک آفلاین)، بعد همگام‌سازی محدود به ماژول‌های نصب‌شده
> (کم‌شدن بار دیتابیس)، و در آخر دانلود بسته‌ها از CDN، پشت یک سوییچ و همراه با نصب‌کننده‌ی کامل
> برای مغازه‌های کم‌اینترنت.

---

## 0. The rules (unchanged)

- `AGENTS.md` is canonical. Also read `CLAUDE.md` and `.claude/skills/hisabche-session-rules/SKILL.md`.
- No commit, push, stash, reset, rebase, `checkout --` or clean. No live SQL. No `.env`. No subagents.
- No `any`, `@ts-ignore` or `eslint-disable`. i18n keys in fa/af/en.
- Migrations only as `docs/*-migration.sql` + `VERIFY-*.sql` + `*.pg.test.ts`, with RLS + REVOKE + an
  explicit GRANT on every new table. Status: `PENDING HUMAN CONFIRMATION`.
- **No new runtime dependency** unless its line in the progress doc is tagged `NEEDS_OWNER_DECISION`.
  Everything below is designed to need **none**.
- **Builds:** never `electron-builder`, Gradle, EAS or `next build`. You **may** run the shell renderer's Vite
  build into a temporary `outDir` during final verification, **only to measure** sizes (§9).
- **Execution model:** implement every slice and write every test; run verification **once**, at the end.

---

## 1. Name the architecture correctly (lesson: words decide designs)

What the owner proposes is **Dynamic Feature Delivery**: a small **core** ships with the app, and **feature
packs** are fetched on demand.

- Android calls the platform version _Play Feature Delivery_; iOS calls it _On-Demand Resources_.
- On the web the same idea is **route-level code splitting** (Next.js already does this per route).

Three neighbours are **not** what we build:

- **Micro-frontends / Module Federation:** independently built and deployed UIs at runtime. Rejected. Two
  builds means two versions of `@hisabche/ui`, React and the validation rules on one screen, which is
  red line 3 ("one UI, one rule set") at runtime.
- **A plugin architecture:** third-party code. That is Part B.2.20 of V61 (apps via OAuth, declarative
  extension points), never executable third-party code.
- **Separate apps per trade.** Rejected by design (V59/V60: one product, one core).

**Our name:** _Core + Feature Packs, one build, content-addressed chunk groups._ One Vite build produces every
chunk. A pack is a **named group of chunks from that same build**. A device can hold the core alone or the
core plus any set of packs. Because every chunk comes from one build, a version mismatch between the core
and a pack **cannot happen**. That removes the worst disadvantage of this architecture (§3, D-#8).

---

## 2. The evidence (measured in the local tree; re-measure, it may have moved)

| #   | Fact                                                                                                                                                                                                                | Where                                                                                                                                                                            | Consequence                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| E1  | Mobile ships **one 7,313,539-byte `index.html`**, everything inlined, `inlineDynamicImports: true`                                                                                                                  | `apps/mobile/vite.shell.config.mjs` (`singleFile: true`) → `packages/app-shell/vite.shell.mjs` lines ~149–244; output `apps/mobile/android/app/src/main/assets/shell/index.html` | All 34 `lazy()` routes in `packages/app-shell/src/app/app.tsx` are **defeated**: every module is parsed at every cold start |
| E2  | `singleFile` existed **because Metro/expo-asset copied only the HTML**. The build now writes straight into the native `assets/shell` folder                                                                         | The comments in the same two files                                                                                                                                               | The reason is gone: multi-file output works from `file:///android_asset/shell/`                                             |
| E3  | Desktop renderer: 49 JS files, **12.4 MB total, 9.35 MB (75%) in one entry chunk** `index-*.js`                                                                                                                     | `apps/desktop/out/renderer/assets/` (built 8 Nov)                                                                                                                                | Splitting exists but barely works                                                                                           |
| E4  | `packages/ui/package.json` has **no `sideEffects` field**; `src/index.ts` has **244 exports**; `app-shell/src/app/providers.tsx` and `route-error.tsx` import the barrel **eagerly**                                | —                                                                                                                                                                                | Rollup must assume side effects and keep the whole barrel in the entry chunk: root cause of E3                              |
| E5  | **All three locales** are statically imported: fa 833 KB + af 822 KB + en 610 KB ≈ 2.26 MB raw JSON in every device bundle, including web-only namespaces (`docs` 56 KB, `landing` 50 KB, `admin` 33 KB per locale) | `packages/i18n/src/messages.ts`                                                                                                                                                  | A device uses one locale (+ a fallback) and never shows the landing, docs or admin                                          |
| E6  | `sync_pull_changes(p_workspace_id, p_cursor, p_limit)` has **no entity filter**. Every device pulls every entity type; `hydrate` reads every row (`select('*')` for some types)                                     | `docs/sync-commit-horizon-migration.sql`, `backend/src/services/sync.service.ts` `pull()` / `hydrate()`                                                                          | Server and database work grows with **every new local engine** (V58–V61 keep adding them)                                   |
| E7  | Index `sync_change_log (workspace_id, sync_version)` exists; the entity index is `(entity_type, entity_id)`                                                                                                         | `docs/SETUP-COMPLETE.sql` ~5728                                                                                                                                                  | An entity-filtered pull can use the first index with a filter; measure before adding a composite index                      |
| E8  | Desktop updates: `electron-updater` generic feed from `/api/updates/...`; the binary is not stored on the backend                                                                                                   | `backend/src/routes/updates.routes.ts`                                                                                                                                           | The pattern of a "manifest from the server, files from elsewhere" already exists: reuse it                                  |
| E9  | Mobile has `expo-file-system`, `react-native-webview`, `expo-sqlite`; no OTA module                                                                                                                                 | `apps/mobile/package.json`                                                                                                                                                       | Packs can be downloaded and stored with what is installed. No new dependency                                                |

**Teacher's verdict.**

- The owner's instinct is right: today every shop carries every trade's code.
- But the cheapest, safest and largest win is **E1–E5: make splitting work locally**. Parse time, memory and
  cold start drop with **zero** network risk and **zero** offline risk.
- **E6 is the database win.**
- Downloading packs over the network only shrinks the **install size**:
  - on desktop, a few MB next to a ~100+ MB Electron runtime;
  - on mobile, a few MB of a larger APK.
    It is worth building, but **last**, behind a flag, and only with a **full installer** kept for
    low-connectivity shops. Measure after Stage 1 before deciding how far to take Stage 3.

---

## 3. Fifty advantages and disadvantages, judged for Hisabche (not generic)

Mark each one in the preflight with **APPLIES / MITIGATED-BY-DESIGN / DOES-NOT-APPLY**, plus the reason.

### Advantages (A)

1. A smaller first install for a single-trade shop.
2. Less storage on low-end Android phones (common in the target market).
3. A faster cold start: only the core is parsed (needs Stage 1 to work at all; see E1).
4. Lower memory: unused trade screens are never parsed or kept.
5. Fewer bytes on paid mobile data, at install and at update.
6. A smaller update when only one pack changed: content-addressed chunks with unchanged hashes are kept.
7. A simpler menu: only installed packs appear (on top of the DNA suggestion and `usePageLook`).
8. Onboarding that feels made for the trade: DNA → composition plan → the packs it needs.
9. Clear module boundaries in code, because a pack must import only the core and itself (enforced by a guard).
10. Bundle budgets per pack become measurable, so regressions are caught in CI.
11. **Less server work: devices sync only the entity types of their packs (E6).**
12. **Less database work:** fewer `hydrate` reads and smaller snapshots per device.
13. Less CDN-to-device traffic for trades that never install heavy packs (charts, PDF).
14. A broken pack can be withdrawn (a manifest flag) without shipping a new app version.
15. Packs map naturally to plan entitlements for **display** ("available in your plan") — never for
    permission.
16. Faster local development: a pack's chunks rebuild in isolation inside the same build graph.
17. Desktop shops with many devices can install only what each counter needs (counter vs back office).
18. Packs make "what does this device run" explicit, which helps support ("which pack version?").
19. Reduced attack surface on the device, but **weak** here: the web app serves all code publicly anyway.
20. Prepares for a future "pack catalog" with no new UI architecture.
21. Locale splitting removes about two thirds of the message payload per device.
22. Removing web-only namespaces (`landing`, `docs`, `admin`) from the shell shrinks every device bundle.
23. A smaller JS heap leaves more room for SQLite and the WebView on 2–3 GB phones.
24. Deterministic content addresses make CDN caching trivial (immutable, forever).
25. Measuring packs exposes dead code (a pack nobody installs is a product question, not a cost).

### Disadvantages (D)

1. **Offline install is impossible:** a pack not yet downloaded cannot open offline. Mitigation: download at
   onboarding (online), a full installer, and an honest offline notice.
2. A download can fail halfway. Mitigation: atomic install (temp dir → verify → rename), resume, retry with
   backoff.
3. A corrupted file. Mitigation: a sha256 per file from the signed manifest; never load an unverified chunk.
4. Supply-chain risk if the CDN is compromised. Mitigation: an Ed25519-signed manifest with the public key
   embedded in the core; the device refuses unsigned or mismatched files.
5. App-store policy: Google Play forbids downloading executable code **except** code that runs in a
   WebView/JS interpreter; Apple has similar limits (guideline 2.5.2). Our packs are WebView JS. **Verify the
   current policy text** before release.
6. More moving parts: a manifest, a store, a loader, GC. Mitigation: no new dependency, one build.
7. A combinatorial test matrix (2^N pack sets). Mitigation: packs depend only on the core; a guard forbids
   pack → pack imports except declared dependencies; test the core alone, the core + each pack, and all packs.
8. **Core/pack version mismatch.** Mitigation: **eliminated**. Packs are chunk groups of the same build,
   addressed by the core build id.
9. Shared dependencies duplicated across packs. Mitigation: a single build; Rollup dedupes shared modules
   into shared chunks that belong to the core or a "shared" pack.
10. First-open jank of a lazily loaded pack. Mitigation: prefetch the installed packs after idle; a skeleton
    per route (one exists in hubs).
11. Battery and CPU during the download and verification. Mitigation: only on Wi-Fi by default (an owner
    setting), in the background, with progress.
12. CDN cost. Mitigation: content-addressed immutable files; packs are small; Cloudflare R2 has no egress fees
    (verify the current pricing).
13. Release pipeline complexity: sign the manifest, upload, publish. Mitigation: one script, an owner step.
14. Debugging "which code is this device running". Mitigation: the core build id + the installed pack list
    are sent in the existing device/sync metadata.
15. Local DB schema per pack would fork schemas. Mitigation: **do not split the schema**. Every local table
    stays in the core migration chain; empty tables cost nothing.
16. Sync complexity when a pack is installed later (backfill). Mitigation: the per-entity-set backfill
    algorithm in §5.6, with tests.
17. Fragmentation of installed sets across a shop's devices. Mitigation: a workspace-level recommended set;
    each device can add more.
18. Permissions confusion ("not installed" vs "not allowed"). Mitigation: three separate states in the UI;
    packs never grant or deny server access.
19. Rollback of a bad pack. Mitigation: keep the previous build's packs until the new build is verified; a
    manifest `withdrawn` flag.
20. Desktop must move from `file://` to a custom protocol to resolve chunks from two roots. Mitigation:
    Electron `protocol.handle` (a documented, standard API).
21. On mobile, a WebView loading from the app sandbox needs file-access settings. Mitigation: a spike first
    (§5.4); keep the APK-bundled path as a fallback.
22. CSP must allow the pack scheme/origin. Mitigation: one constant shared by the protocol and the CSP.
23. Garbage collection of old packs. Mitigation: keep the current + previous build; delete the rest after a
    successful launch.
24. The guard against "a pack imports another pack" adds friction. Mitigation: declare dependencies in the
    pack registry; the guard reads them.
25. The product promise "everything offline" changes wording. Mitigation: landing claims must state "your
    trade's tools work offline once installed" (guard `landing-claims.test.ts`).

**Corrections to the pasted list:**

- "Different technologies per module" is a **disadvantage** for us (one UI, one stack), not an advantage.
- "Smaller attack surface" is weak, because the web serves the same code.
- "150 MB → 30 MB" is not supported by the evidence: the measured app JS is 7.3–12.4 MB.
- "Per-pack DB migrations" must be avoided, not managed (D-15).

---

## 4. The target design (what to build)

### 4.1 One pack registry, derived from what exists (no parallel model)

`packages/validation/src/schemas/feature-packs.ts` `[NEW]`:

- `FEATURE_PACKS` = `core` + one pack per **engine group** in `ENGINES`
  (`packages/validation/src/schemas/business-capabilities.ts`). Each `ENGINES` entry gains `pack: PackId`.
- Each pack declares:
  - `routes`: app-shell paths;
  - `navItems`: keys of the one nav contract;
  - `i18nNamespaces`;
  - `syncEntities`: from `syncEntitySchema`;
  - `dependsOn`: other packs, usually `[]`;
  - `budgetKb`: gzip.
- The **core** holds:
  - auth, sync, settings, customers, products, the basic invoice and the till;
  - everything the first value of every trade needs;
  - **every SQLite table** (D-15).
- `packsForPlan(plan: CompositionPlan)` uses V60's `composeBusinessSolution` to suggest packs. **A pure function;
  no new resolver.**
- **Guard** `packages/validation/src/__tests__/feature-packs.test.ts`:
  - every app-shell route belongs to exactly one pack;
  - every nav item belongs to one pack;
  - every sync entity belongs to `core` or exactly one pack;
  - `dependsOn` has no cycles;
  - every `ENGINES` entry has a pack.

### 4.2 Make splitting work (Stage 1 — local; the largest win)

1. **`sideEffects`** in `packages/ui/package.json`.
   - Audit every module under `packages/ui/src` for top-level side effects (registrations, CSS imports,
     polyfills).
   - List exactly those (`"**/*.css"` plus each real file) and declare the rest side-effect-free.
   - The guard `packages/ui/src/__tests__/side-effects-declared.test.ts` scans for top-level calls outside
     declarations and fails if one is not listed.
   - Do the same audit for `@hisabche/api`. Careful: `registerTokenGetter` runs at import by design (CLAUDE.md
     "token ready").
2. **No eager barrel imports in the shell.** `providers.tsx` and `route-error.tsx` import from deep subpaths
   (add the `exports` entries they need). A guard forbids `from '@hisabche/ui'` in
   `packages/app-shell/src/app/**` (the eager files).
3. **Remove `singleFile` for mobile** (E2): multi-file output into `android/app/src/main/assets/shell/`.
   - Verify that `react-native-webview` loads relative chunks from `file:///android_asset/shell/` (it loads the
     page from there already).
   - Keep the `stripCrossorigin` plugin.
   - Update the comments that explain `singleFile` so the next reader learns why it is gone.
4. **Chunk groups = packs.** `manualChunks` in `vite.shell.mjs` reads `FEATURE_PACKS` (plain JS import of a
   generated JSON, written by `scripts/packs/emit-pack-map.mjs` from the registry, because the config is `.mjs`
   on purpose). `build.manifest: true`.
5. **Locale split.**
   - `packages/i18n/src/messages.ts` loads **only the active locale** via dynamic `import()`, plus fa as the
     fallback for af only if the existing fallback rule says so (read it first).
   - Web-only namespaces (`landing`, `docs`, `admin`, `blog`, `oauth` if web-only; verify each) are excluded
     from the shell catalog at build time, **without** removing keys from the source JSON.
   - The guard: no shell component uses an excluded namespace.
6. **Prefetch after idle** for installed packs (`requestIdleCallback`), so the first open is instant without
   blocking cold start.

### 4.3 Bundle budgets (measure, then protect)

- `scripts/packs/report.mjs` reads Vite's `manifest.json` and prints the size per pack (raw + gzip):
  - the core entry;
  - each pack;
  - the shared chunks.
- `packages/app-shell/bundle-budgets.json` holds the **measured** numbers after Stage 1, plus 10%. A test reads
  the last report if present (the CI step runs the build first; locally it is skipped with a clear
  message, never green-by-default).

### 4.4 Pack store and loader (Stage 3 — network; behind a flag)

**The delivery path** (zero backend load):

- Files at `https://<cdn>/packs/<coreBuildId>/<file>` on Cloudflare R2 (or the existing CDN), headers
  `Cache-Control: public, max-age=31536000, immutable`.
- The manifest `packs/<coreBuildId>/manifest.json` lists, per pack: its files, each file's sha256, the
  size, and `dependsOn`. Detached signature `manifest.json.sig` (Ed25519).
- The **public** key is compiled into the core. Signing happens at release, done by the owner (see §8).
  Signing never happens on a request path.

**The device pack store** (one implementation, two adapters):

- Shared logic in `packages/app-bridge/src/packs/` `[NEW]`. Pure: `planInstall(manifest, installed, wanted)`,
  `verifyFile(bytes, sha256)`, `verifyManifest(bytes, sig, publicKey)` (WebCrypto Ed25519 where available;
  otherwise Node `crypto` on desktop and a verified JS fallback only if the owner approves a dependency; check
  that the WebView supports Ed25519 in WebCrypto first).
- **Install steps:**
  1. download into `packs/.staging/<buildId>/`;
  2. verify every file;
  3. atomic rename into `packs/<buildId>/`;
  4. write `installed.json` last.
- Never load a file that has no entry in a verified manifest.
- **GC:** keep the current + previous build; delete the rest after a successful launch.

**Desktop adapter:**

- Register a privileged scheme `hisabche-app://` (`protocol.registerSchemesAsPrivileged`, standard + secure)
  and serve with `protocol.handle`.
- A request for `/assets/<file>` resolves from the bundled renderer folder first, then from the verified pack
  store. Load the renderer from `hisabche-app://app/index.html` instead of `file://`.
- The CSP in `apps/desktop/electron/main/index.ts` allows the scheme (one shared constant).
- Read the existing `file://` lessons in `CLAUDE.md` (absolute paths, `crossorigin`): the protocol removes
  them, and the comments must say so.

**Mobile adapter:**

1. **Spike first** (`docs/architecture/packs/SPIKE-mobile-loader.md`): on first launch, copy the bundled
   `assets/shell/` to `FileSystem.documentDirectory + 'shell/<buildId>/'`; installed packs are written beside
   it; the WebView loads `index.html` from there, with the minimum file-access props.
2. Prove on a real device:
   - the chunks load;
   - nothing outside `shell/` is readable from the page;
   - the outbox and SQLite bridge still work.
3. If the spike fails, keep the APK-bundled path (Stage 1 still delivers most of the win) and record
   `BLOCKED_EXTERNAL` with evidence.
4. Android `WebViewAssetLoader` is the cleaner long-term route, but needs native work; write it up as the
   alternative.

**Web:** no pack store. Next.js already splits by route. Packs only drive the menu (installed = "enabled for
this workspace" on the web).

**Flags:** `packs.delivery = off | on` (default **off**) and `packs.installer = full | core` (the desktop
build variant: full = all packs prebundled, the default for now).

### 4.5 Selection UX

- **Onboarding:** after the DNA questions, V60's `composeBusinessSolution` → `packsForPlan` → the user sees the
  suggested packs with sizes and can add or remove before finishing. With delivery on, the download starts
  immediately and shows progress; the core is usable during it.
- **Settings → "Modules on this device":** installed / available / downloading / failed, with a retry.
  Removing a pack removes **code only**, never data. Its data stays in SQLite and keeps syncing if any other
  device of the workspace needs it (see §4.6).
- **Offline:** opening a route of a not-installed pack shows one honest notice ("connect once to install this
  module"); never a blank page.
- **Three distinct states, never merged:** not installed (device) · not in plan (entitlement) · not allowed
  (permission). Reuse the existing notices (`CloudRequiredNotice`, `NoAccessNotice`).

### 4.6 Module-scoped sync (the database win, E6)

1. **Migration `sync-scope-01`:** `sync_pull_changes_v2(p_workspace_id, p_cursor, p_limit, p_entity_types
text[])`, where `NULL` = all types (backward compatible). Same SECURITY DEFINER, same REVOKE, same
   horizon. Keep v1 until every client sends v2.
2. **The client** sends the entity types of `core` + its installed packs. The server validates them against
   `syncEntitySchema`; unknown types → 400.
3. **The backfill rule when a pack is installed later** (teach this carefully):
   - the device's shared cursor is `C`;
   - it pulls **only the new types** from cursor 0 up to `C`, in pages;
   - then the shared pull continues from `C`, now including those types.
   - If 0 is behind the horizon, use `/api/sync/snapshot` for those types only.
4. **Hydrate:** explicit column lists per entity (no `select('*')`). Group by type. One query per type per page.
5. **Index:** measure on staging with `EXPLAIN (ANALYZE, BUFFERS)`. If the filtered pull scans too much, add
   `(workspace_id, entity_type, sync_version)` in a separate migration. **Do not add it on a guess.**
6. **Tests:**
   - pure: the backfill planner;
   - pg (`sync-scope-01.pg.test.ts`): filtered pull, `NULL` = all, unknown type refused, horizon, tenant
     isolation;
   - HTTP: install a pack later → its entities arrive exactly once; other types are never re-sent.

### 4.7 Other load reductions that come with this work

- **Packs and manifests never touch the backend** (CDN). The device learns its entitlement from data it
  already syncs, or from the offline licence (`offline-license.service.ts`); no "can I download?" call per pack.
- **Unmounted packs make no queries.** Verify with a test that a route of a not-installed pack issues no
  React Query request (the `look.active` rule already does this for hidden pages; extend it to packs).
- **Persisted query cache + one locale** means fewer refetches on cold start. Measure the request count on cold
  start before and after (a scripted count in the desktop dev build is enough).
- **Sync wake-ups** already carry no data (`sync-stream.ts`). Do not change that.
- **Never move a correctness check from the server to the device** to save load. Load is reduced by doing
  **less redundant** work, not by trusting the client.

---

## 5. Files and folders

```
packages/validation/src/schemas/feature-packs.ts              [NEW] registry + packsForPlan
packages/validation/src/__tests__/feature-packs.test.ts        [NEW]
packages/validation/src/schemas/business-capabilities.ts       ENGINES[*].pack
packages/ui/package.json                                       sideEffects
packages/ui/src/__tests__/side-effects-declared.test.ts        [NEW]
packages/app-shell/vite.shell.mjs                              manualChunks from the pack map, manifest:true, singleFile removed for mobile
packages/app-shell/src/app/providers.tsx, route-error.tsx      deep imports
packages/app-shell/src/__tests__/no-eager-barrel.test.ts       [NEW]
packages/app-shell/bundle-budgets.json                         [NEW] after the first measurement
packages/i18n/src/messages.ts                                  active-locale dynamic import, shell namespace filter
packages/app-bridge/src/packs/{manifest,store,plan,verify}.ts  [NEW] shared pack logic
apps/desktop/electron/main/{protocol.ts,packs.ts}              [NEW] hisabche-app:// + store adapter; index.ts uses it
apps/mobile/src/packs/*                                        [NEW] after the spike succeeds
apps/mobile/vite.shell.config.mjs                              singleFile: false
backend/src/services/sync.service.ts                           v2 pull, explicit hydrate columns
backend/src/routes/sync.routes.ts                              entityTypes param (validated)
packages/app-shell/src/features/sync/sync-engine.ts            sends entity types; backfill planner
docs/sync-scope-01-migration.sql + VERIFY + backend/src/__tests__/sync-scope-01.pg.test.ts
scripts/packs/{emit-pack-map.mjs,report.mjs,sign-manifest.mjs,publish.md}
docs/architecture/packs/{00-OVERVIEW.md,ADR-0001-one-build-chunk-groups.md,ADR-0002-schema-stays-in-core.md,
                        ADR-0003-signed-manifest.md,SPIKE-mobile-loader.md,RUNBOOK-withdraw-a-pack.md}
```

**Documentation rules** (same as V61 Part C):

- MADR-format ADRs for every hard-to-reverse choice;
- a failure-mode table (download fails, bad signature, CDN down, pack withdrawn, offline first open);
- a runbook for withdrawing a pack;
- every size in the docs comes from `report.mjs` output, never from memory.

---

## 6. Tests (write them all; run them in §9)

- `feature-packs.test.ts` (the registry guard).
- `side-effects-declared.test.ts`.
- `no-eager-barrel.test.ts`.
- **Pack logic (app-bridge):**
  - plan install / upgrade / remove;
  - a bad hash refused;
  - a bad signature refused;
  - an interrupted staging dir ignored and cleaned;
  - GC keeps current + previous.
- **Desktop protocol:**
  - resolves bundled-first, then the store;
  - refuses a path outside its roots (path traversal);
  - refuses an unverified file.
- **i18n:** loading `en` does not load `fa`/`af`; a missing key still throws in tests (the `t()` rule); the
  shell never references an excluded namespace.
- **Sync:**
  - the backfill planner (pure);
  - `sync-scope-01.pg.test.ts`;
  - the HTTP: a later install backfills once.
- **UX:** three distinct states (not installed / not in plan / not allowed) render three different notices; a
  not-installed route makes zero API calls.
- **Existing guards that must stay green, not be weakened:** `route-parity.test.ts`,
  `offline-matrix-guard.test.ts`, `capability-has-consumer.test.ts`, `index-exports-server-safe.test.ts`,
  `landing-claims.test.ts`, `one-ux.test.ts`.

---

## 7. Slices (in order; never stop between them)

1. **Phase 0 (static):** re-measure E1–E9 and write `docs/architecture/packs/V62-PREFLIGHT.md`, including the
   50-item table from §3 marked for Hisabche.
2. **4.1** the pack registry + guard.
3. **4.2** steps 1–2 (`sideEffects`, deep imports) + guards.
4. **4.2** step 5 (the locale split).
5. **4.2** steps 3–4 + 6 (multi-file mobile, chunk groups, prefetch).
6. **4.6** module-scoped sync (migration, server, client, backfill).
7. **4.7** load checks.
8. **4.3** the budget tooling.
9. **4.4** the pack store logic + the desktop adapter (flag off) + the mobile spike document.
10. **4.5** the selection UX (works with the flag off as "enabled modules" and with it on as downloads).
11. The docs and ADRs.

After each slice, update `docs/architecture/V62-IMPLEMENTATION-PROGRESS.md`. Owner decisions get the safe
default + `NEEDS_OWNER_DECISION`, and you continue. If your context runs low, write
`NEXT: slice N, step …` first.

---

## 8. Owner actions (list them; never perform them)

1. Create the CDN bucket (e.g. Cloudflare R2) and its public domain for `/packs/`.
2. Generate the Ed25519 pack-signing key pair. The **private** key is stored where the owner keeps signing
   keys (memory: keys live in the DB, and the backend stays stateless). The public key goes into the core
   build config.
3. Confirm the current Google Play and Apple policy text on downloaded WebView JavaScript:
   - https://support.google.com/googleplay/android-developer/answer/9888379
   - https://developer.apple.com/app-store/review/guidelines/
4. Decide the default installer for desktop (`full` vs `core`) and the mobile download rule (Wi-Fi only?).
5. Run `sync-scope-01-migration.sql` + VERIFY, then deploy the backend **before** clients send v2.
6. Run the mobile loader spike on a real device.

---

## 9. Final verification (once)

Run these sequentially, with `TMP/TEMP=C:/Users/hamed/Desktop/hisabche/.esbuild-tmp`:

- `tsc --noEmit` in validation, api, store, i18n, ui, app-shell, app-bridge, local-engine, backend, apps/web,
  apps/desktop and apps/admin;
- the full vitest suites for validation, api, local-engine, ui, app-shell and backend
  (`--exclude '**/*.pg.test.ts'`);
- `npx jest` in desktop and mobile;
- ESLint on changed files;
- **one** shell renderer Vite build into a temp `outDir` (desktop config, and mobile config with
  `singleFile:false`), then `node scripts/packs/report.mjs`. Record the core entry size and the size per pack,
  **before vs after** (E1/E3 are the "before").

pg tests stay `BLOCKED` on this machine (`initdb.exe` is missing). Never weaken a guard.

## 10. Persian final report

Include:

1. The decision.
2. The measured before/after table:
   - mobile entry;
   - desktop entry;
   - total JS;
   - message payload per device;
   - the number of sync entity types per device for a sample trade.
3. The 50-item table with APPLIES / MITIGATED / DOES-NOT-APPLY.
4. Files changed.
5. The migrations in run order (`PENDING HUMAN CONFIRMATION`).
6. The commands and real results.
7. The owner actions.
8. The remaining gaps.

Allowed statuses: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `VERIFIED_WITH_LIMITATIONS` ·
`BLOCKED` · `NOT_IMPLEMENTED`.
