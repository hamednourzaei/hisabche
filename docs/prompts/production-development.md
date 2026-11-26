# HISABCHE V13 — SELF-UPDATING CORE, INDEPENDENT MODULES, STAGED ROLLOUT & PROVEN RECOVERY

## 0. EXECUTION CONTRACT (READ FIRST, APPLIES TO EVERYTHING BELOW)

You are implementing this in the real Hisabche repository. This is an implementation mission, not a design document exercise. Never stop at documentation or proposals.

### 0.1 Evidence first, never guess

- Every claim about the current repository, platform behavior, sizes, versions, or test results must come from something you actually inspected, ran, or read in official documentation during this mission.
- Save raw evidence (command output, file paths, measured numbers) under `docs/audits/evidence/`. Reports reference evidence files.
- If a fact is missing (for example, whether expo-updates is configured, what the Electron updater does, whether Vercel Skew Protection is enabled), find it in the code or the official docs. If it still cannot be determined, record `NEEDS_OWNER_DECISION` or `UNVERIFIED` with the exact reason and continue with the most conservative reversible behavior.
- Never fabricate test results, measurements, or "verified" statuses. A feature without an executed test is `IMPLEMENTED_NOT_VERIFIED`, never `VERIFIED`.

### 0.2 Owner decisions never stop the project

- When a decision cannot safely be made autonomously, mark it `NEEDS_OWNER_DECISION` in `PROGRESS.md` and in `docs/architecture/OWNER-DECISIONS.md` (decision, options, conservative default applied, impact of each option).
- Apply the conservative, reversible default and continue with independent slices. Never invent business rules (no invented thresholds presented as facts; defaults must be labeled "default, owner to confirm").

### 0.3 Verification policy for this repository (the full test suite is large and slow)

- Do NOT run the test suite, build, or lint between slices.
- After each slice, do a desk-check only: re-read the code you wrote against the invariants in section 11 and the bug-class ledger in section 13.4, and fix problems by reading, not by running.
- Write the tests for each slice together with the slice (tests are part of the slice, not a later phase).
- Run verification exactly once, in the Final Verification Gate (section 15), after all slices are written. If it finds failures, fix them, re-run only the failed suites and their direct dependents, and then do one last full run of everything.

### 0.4 Safety

- Never modify production data, run production migrations, deploy, perform real payments, send real notifications, or read/expose `.env` files.
- Never commit or push. Preserve unrelated user changes (do not reformat or revert files you did not need to touch).
- Do not upgrade Expo SDK or React Native. Do not enable React Native New Architecture. No Redis. No second sync engine, second auth system, or parallel entitlement system. Do not duplicate accounting or financial logic. Do not weaken platform security. Do not bypass app-store or Google Play policy. No arbitrary remote-code execution. Do not delete existing user data on update or module removal.
- Database changes follow existing conventions: `docs/*-migration.sql`, `docs/VERIFY-*.sql`, real PostgreSQL `*.pg.test.ts`. Migrations are written but never executed against production.
- Maintain `PROGRESS.md` after every slice.

### 0.5 Slice order and honesty about scope

Implement in the order of section 14. If you cannot finish everything, finish earlier slices completely (code + tests + docs) before starting later ones, and mark the remainder `PARTIALLY_COMPLETE` honestly. Do not leave stubs that report success.

---

## 1. MISSION

Turn Hisabche into a platform where the core runtime and optional modules are independently versioned, delivered, verified, activated, rolled back, and rolled out in stages, so users do not have to manually reinstall the whole application for compatible updates, on every platform where that is technically and legally possible.

Target architecture:

Minimal Native Bootstrap → Updateable Core Runtime → Independently Versioned Feature Modules → Shared Backend Contracts (API + DB + Sync)

Three expectations that define the product:

| Change                           | Expected result                                                     |
| -------------------------------- | ------------------------------------------------------------------- |
| Fix a profit calculation in Core | New Core version delivered and activated without a manual reinstall |
| Add a new report                 | Report module downloaded and activated without a manual reinstall   |
| Native Android change            | New binary delivered via the permitted app distribution path        |

Mandatory rollout rule: a new version must never become active for all users at once. It goes internal channel → small cohort → wider cohort → everyone. If error rates rise, the rollout halts automatically and unhealthy versions are rolled back (section 9).

Never claim zero-manual-update on a platform whose native distribution constraints require a binary update.

---

## 2. PHASE ZERO — REAL BASELINE (EVIDENCE ONLY)

Inspect the actual repository before designing anything. Produce `docs/architecture/SELF-UPDATING-BASELINE.md` and raw evidence files.

Inspect and record actual current values:

- **Monorepo:** Turborepo layout, packages (including `packages/app-shell`, `packages/ui`, `packages/sync`, `packages/db`, `packages/offline`, validation/domain packages), how apps consume them.
- **Web:** Next.js version, deployment model (Vercel), dynamic imports, route splitting, cache headers, any service worker, deployment IDs / skew protection status, how stale tabs behave today.
- **Windows / Electron:** main/preload/renderer structure, context isolation and sandbox settings, IPC surface, packager (electron-builder or other), current updater (electron-updater / Squirrel / NSIS / none), signing configuration, native dependencies, where the renderer bundle loads from.
- **Android:** Expo SDK 51 / RN 0.74 config, whether `expo-updates` is installed and configured, `runtimeVersion` policy, channels, code-signing config, EAS config, native modules and permissions, build variants, and whether the shared `app-shell` runs inside a WebView (this changes what "Core Runtime update" means on mobile; determine it from code).
- **Backend:** Fastify routes related to licensing, entitlements, devices, versions; existing update/config endpoints; artifact storage options already available (Supabase Storage, Render disk, other).
- **Database/offline:** local schema and migration framework (WatermelonDB), outbox, sync cursors, conflict handling, offline license verification, backup/recovery.
- **Existing module/capability concepts:** capability registry, industry profiles, feature gating. The update system must reuse these, not create competing ones.

Measure (record command and output):
initial web JS size, largest route bundles, Electron installer size and installed size, Android APK/AAB size, cold start time on each platform where measurable, and the current behavior on update failure. For anything that cannot be measured in this environment, write `UNMEASURED` and why. Do not estimate improvements.

---

## 3. PHASE ONE — LAYERS AND REAL CANDIDATE MODULES

Define and enforce these layers.

**A. Native Bootstrap.** Smallest practical platform-specific foundation: startup, secure storage, signature verification of update metadata and artifacts, slot management, activation, recovery, minimum-runtime compatibility, critical IPC/native interfaces. Contains no optional business features. Native code is never downloaded.

**B. Updateable Core Runtime.** Shell, navigation, workspace context, shared contracts, auth integration, capability resolution, module registry and lifecycle, API client contracts, shared UI, localization, core financial/accounting workflows (these stay Core; do not move accounting or financial logic into optional modules), update orchestration, compatibility management. Core must never import optional modules.

**C. Optional Feature Modules.** Identify from the real dependency graph which capabilities can truly be independent (candidates: advanced inventory, payroll, HR, CRM, project, production, advanced reports, analytics, industry packs, optional integrations). Do not assume any candidate is separable; prove it from imports. Each module has its own version, manifest, dependency declarations, compatibility requirements, permissions, lifecycle, update history, test suite, and failure/rollback behavior. Industry packs compose existing modules and never copy their logic.

**D. Asset and data packs.** Templates, report definitions, localization packs, help content, reference data. Executable code and non-executable data are strictly separated; data packs are validated against Zod schemas and never executed.

Write `docs/architecture/SELF-UPDATING-ARCHITECTURE.md` and `docs/architecture/MODULE-ARCHITECTURE.md` from real findings.

---

## 4. ARCHITECTURAL PRINCIPLE THAT MAKES THIS TESTABLE: PURE CORE + PORTS + THIN ADAPTERS

All update logic lives in one shared, platform-independent TypeScript package (for example `packages/updater-core`). It has no direct dependency on Electron, React Native, the DOM, `fs`, `fetch`, `Date`, or crypto libraries. It depends only on injected ports:

- `Clock` (now, monotonic ticks)
- `FileStore` (read/write/rename/remove/list/stat/free-space, atomic rename, fsync)
- `Transport` (ranged GET with resume, timeouts)
- `SecureStore` (monotonic counters, trusted keys, device identity)
- `Verifier` (Ed25519 verify, SHA-256)
- `LocalDataProbe` (pending outbox count, active financial transaction flag, local schema version, offline license state)
- `Telemetry` (append-only local queue)
- `Process` (restart request, health reporting)

Platform adapters (Electron, Android/Expo, web) implement the ports and contain no update decisions. Every adapter must pass the same shared adapter contract test suite.

This is what lets crash, disk-full, and corruption scenarios be tested deterministically in Node without launching apps.

---

## 5. PLATFORM STRATEGY (INSPECT FIRST, THEN IMPLEMENT THE BEST SUPPORTED PATH)

### 5.1 Web (Next.js on Vercel)

- Use the existing deployment model. Route-level and feature-level dynamic imports; versioned immutable assets; correct cache headers.
- Detect version skew: compare the running build ID with the server's current build ID (lightweight version endpoint or deployment ID header). Handle stale tabs: no execution of incompatible chunks; retry failed chunk loads with backoff; show a reload prompt only when needed and never while an invoice/payment/ledger operation is in progress (defer until the operation completes).
- Evaluate Vercel Skew Protection and record whether it is enabled/available; do not assume.
- Module artifacts on web are served through the normal build/deploy pipeline unless the code proves independent runtime delivery is safe and necessary. Do not claim zero downtime without evidence.
- Backend (Render) keeps serving the previous compatible API versions during rollout (section 10).

### 5.2 Windows (Electron)

Independently updatable layers: (1) renderer Core bundle, (2) optional module bundles, (3) static/data packs; Electron shell and Bootstrap update via the secure app updater.

- Renderer/module bundles are signed archives stored in per-version slots under the app data directory (`slots/<layer>/<version>/`), with a `current` pointer switched atomically and a `previous` pointer retained. Bundles are loaded through a restricted custom protocol with strict CSP. Never expose Node.js to downloaded renderer code. Keep context isolation, sandbox, restricted preload IPC. Never load an unsigned or unverified bundle. No generic arbitrary-code loader: a module is a signed bundle conforming to the typed extension contract, nothing more.
- Shell/Bootstrap updates use the existing updater (or the most conservative supported one if none exists). Signed installers, SHA-256 or stronger verification, disk-space check, resumable download where safe, previous-version retention, restart coordination.
- Windows-specific realities to handle and test: file locks held by antivirus/indexers during rename (retry with bounded backoff), reserved filenames (CON, NUL, etc.), path-length limits, case-insensitive collisions, rename across volumes, multiple app instances (single-update lock), OS sleep/shutdown during update.
- If the current Electron structure cannot safely load independently delivered renderer bundles, first create the smallest safe boundary and document remaining native-shell limitations. Code-signing certificate acquisition/trust is a likely `NEEDS_OWNER_DECISION`.

### 5.3 Android (Expo SDK 51 / RN 0.74)

- Determine from code and SDK 51 documentation what is configured: `expo-updates`, `runtimeVersion` policy, channels, code signing, custom update server vs EAS. Do not assume.
- JS and compatible assets: OTA using the supported mechanism, with runtime-version compatibility validation, signed/trusted metadata, channel config, staged rollout, background download, integrity verification, previous-update recovery, persisted update state, safe activation, offline fallback, version observability.
- If the shared `app-shell` runs in a WebView, define precisely what is delivered how, and keep one authority for versions (no second registry).
- OTA must never bypass native compatibility. New native modules, native dependency changes, permission changes, native config changes, Expo SDK or RN upgrades require a new binary through the approved distribution path. Introduce a native-dependency fingerprint so the update system refuses OTA when the installed runtime is incompatible and routes the user to the binary update path.
- Distribution reality for Iran/Afghanistan: Google Play and Expo-hosted infrastructure may be unreachable or unreliable for many users. Record this as `NEEDS_OWNER_DECISION`: where OTA artifacts are hosted (self-hosted update server vs EAS), how the APK is distributed (Play, local app stores, direct download), and whether in-app APK installation (which needs a native permission, hence a binary change) is acceptable. Implement the self-hostable path behind the same control plane if the code allows it; never build a second registry.
- Do not claim every Core update can be OTA.

### 5.4 Capability matrix

Create `docs/architecture/UPDATE-COMPATIBILITY-MATRIX.md`: for every component (Bootstrap, Core runtime, each module, data packs, Electron shell, native Android layer) on Web / Windows / Android, state exactly one of: independent update supported; requires restart; requires app-shell update; requires app-store/binary distribution; unsupported; requires owner decision. Never hide a limitation.

---

## 6. ONE AUTHORITATIVE UPDATE CONTROL PLANE

Extend existing backend/infrastructure; do not create a competing registry. It manages: Core versions, module versions, platform/runtime/API/DB compatibility, channels (development, internal, beta, stable), release metadata, artifact locations, hashes, signatures, release status, rollout percentage and cohort rules, minimum supported version, deprecation, rollback targets, halted/revoked status.

- It identifies the caller from the authenticated session and registered device. It never trusts client-reported versions for authorization; client-reported versions only select which compatible update to offer.
- It uses the existing licensing/entitlement system to decide which modules a workspace may receive. A module can never grant itself a license or permission. Update-channel access is server-controlled.
- Revoking an entitlement stops new installs/updates of that module and disables it at runtime, but never deletes its data.
- All control-plane endpoints are tenant-isolated and tested for cross-tenant access.

---

## 7. MANIFESTS AND TRUST MODEL

Define Zod schemas using existing conventions.

**Core manifest:** id, version (SemVer), channel, platforms, min/max Bootstrap version, API compatibility range, DB compatibility range, module compatibility, required migrations, artifact hash and size, signature metadata, release notes (i18n keys), criticality, minimum supported version, rollback target, activation requirements.

**Module manifest:** id, version, dependencies, optional dependencies, required Core range, API range, DB schema range, platforms, required capabilities, required permissions, offline support, artifact metadata, hash, signature metadata, migration references, release notes, rollback compatibility.

Reject: duplicate IDs, invalid SemVer, dependency cycles, invalid platform combinations, incompatible Core ranges, invalid signatures, missing artifacts, unsupported migrations, invalid ranges. Version ordering uses a real SemVer implementation, never string comparison.

**Trust model (use an established design rather than inventing crypto):**

- Evaluate a TUF-style role separation (root / targets / snapshot / timestamp) and record the decision in `UPDATE-SECURITY.md`. If a mature library fits the stack, prefer it; otherwise implement a minimal subset with the same properties. Use Ed25519 via a vetted library and canonical JSON (RFC 8785) for signed payloads.
- Signed metadata with expiry and a monotonically increasing sequence number; the client persists the highest seen sequence per layer in secure storage (replay and downgrade protection). Legitimate rollback is a signed rollback directive with a higher sequence number, never a version downgrade.
- Public keys are embedded in Bootstrap with a key-rotation path; private keys exist only in the release-signing environment and never in bundles, renderer, packages, or the repository.
- Clock-skew rule (important for devices with wrong dates): expired metadata or an unreliable local clock must never disable the already-installed working version or normal business operation; it only blocks installing new versions. Use a bounded tolerance and a server-time hint, and test with skewed clocks.
- Safe archive extraction: reject path traversal, absolute paths, symlinks/hardlinks, reserved Windows names, case-collision duplicates, oversized or decompression-bomb archives, unexpected file types.
- Never trust: client success flags, module-declared permissions, unauthenticated manifests, unverified URLs, mutable URLs without hash verification.

Write `UPDATE-MANIFEST-SPEC.md` and `UPDATE-SECURITY.md`.

---

## 8. LIFECYCLE, ACTIVATION AND ROLLBACK

### 8.1 State machine

States: UP_TO_DATE, CHECKING, UPDATE_AVAILABLE, DOWNLOADING, PAUSED, VERIFYING, COMPATIBILITY_CHECK, READY_TO_INSTALL, INSTALLING, ACTIVATING, RESTART_REQUIRED, ACTIVE, ROLLBACK_REQUIRED, ROLLING_BACK, FAILED, UNSUPPORTED, INCOMPATIBLE.

Implement as a table-driven machine with an explicit transition table. A test enumerates every (state × event) pair and asserts it is either a documented valid transition or an explicit rejection; there is no unhandled pair. Persist state so it survives process death.

### 8.2 Update algorithm

Follow, in order: identify platform/Bootstrap/Core/modules/runtime → authenticated metadata request → verify channel and cohort → validate entitlement → resolve dependencies → validate Core/API/DB compatibility → check free space → download only the required artifacts (resumable) → verify hash → verify signature → stage in an inactive slot → run compatibility self-checks → check local-data safety (section 11) → activate atomically → run startup health checks → confirm healthy → keep the previous version → record telemetry → clean obsolete artifacts only when safe.

Rules: never expose a partial or unverified artifact; never activate an incompatible version; never delete the last known-good version before a successful health check.

### 8.3 Policies

Configurable: automatic download, automatic activation when safe, activate on next restart, ask before restart, Wi-Fi only (mobile), pause on low storage, pause on critically low battery. Defer activation while invoice creation, payment recording, ledger posting, an active DB transaction, or unsynced financial operations are in progress.

### 8.4 Atomic activation and rollback

- Slot model with `current` and `previous` pointers switched via atomic rename (or the platform's equivalent); a boot-attempt counter; a "healthy" confirmation written only after the health check passes.
- Health checks distinguish local runtime failures (bundle fails to load, core init throws, local DB cannot open, required contract missing) from external failures (backend outage, network down). External failures never trigger rollback of a healthy runtime.
- Crash-loop guard: after N failed boots of a new version, roll back automatically, mark that version as bad on this device, and do not retry it until a newer version is published. Prevent infinite update/rollback loops with a persisted attempt ledger.
- Rolling back JS/renderer layers is supported; native code is never "rolled back" by JS. For native updates use the platform's updater and recovery.
- Rollback targets must be compatible with the current DB contract and local schema (verified by test), otherwise rollback is refused and the system moves to the safe-mode path defined in `UPDATE-ROLLBACK-AND-RECOVERY.md`.

Write `UPDATE-LIFECYCLE.md` and `UPDATE-ROLLBACK-AND-RECOVERY.md`.

---

## 9. STAGED ROLLOUT WITH AUTOMATIC HALT AND ROLLBACK (MANDATORY)

- Rings: development → internal → canary (small cohort) → expanded cohort → everyone. Promotion between rings requires explicit control-plane action or an automatic gate that passes.
- Cohort assignment is deterministic and server-side: hash(deviceId + releaseId) mapped to a bucket; the same device always gets the same decision for the same release; percentages can only increase while a release is healthy.
- Health signals per release and ring: activation success rate, startup-health failure rate, rollback rate, signature/integrity failure rate, crash-free session rate (where available), update-related support signals. Each has a configurable threshold and a minimum sample size so a handful of events cannot trigger a false halt or hide a real problem. Provide default thresholds labeled "default, owner to confirm".
- Auto-halt: when a threshold is exceeded with sufficient sample size, the control plane freezes promotion, stops offering that release to new devices, and publishes signed halt metadata. Clients that already activated the halted release receive a signed rollback directive pointing to the rollback target, applied only when safe (section 8.4 and section 11).
- Kill switch: an operator can halt or revoke any release immediately; revocation is signed, replay-protected, and honored by clients even when they are mostly offline once they next sync.
- All of this is covered by deterministic simulation tests (simulated devices, simulated failure injection) that prove: staged exposure never exceeds the ring, halt triggers at the configured threshold, no halt below the minimum sample, halted releases are never offered again, rollback directives are applied only when safe.

---

## 10. DATABASE AND API COMPATIBILITY

- Expand-and-contract migrations only. Expand: nullable columns, new tables, compatible indexes, new RPCs, old interfaces preserved. Transition: old and new clients both work. Contract: only after every supported client is past the boundary and the owner has approved the criteria (`NEEDS_OWNER_DECISION` by default).
- No destructive migration during routine module activation; no production migration initiated by a client; migrations execute server-side only under explicit ownership; idempotent where expected; each migration has a rollback or forward-recovery note; real PostgreSQL tests (`*.pg.test.ts`) plus `docs/VERIFY-*.sql`.
- Fastify API: contract versioning, compatibility ranges, deprecation metadata, minimum supported client version, graceful structured response for unsupported clients (client shows an actionable message and keeps working offline), capability negotiation by version. Use the existing routes and contracts; no second API architecture.
- Local schema (WatermelonDB): a runtime that needs a newer local schema must migrate safely and never before the data-safety checks pass; a runtime older than the local schema must refuse to open it destructively and route to safe mode, never downgrade data.

Write `API-DATABASE-COMPATIBILITY.md`.

---

## 11. OFFLINE-FIRST INVARIANTS (EACH ONE MUST HAVE A NAMED TEST)

- I1 An update never deletes local business data.
- I2 An update never deletes or reorders pending outbox records.
- I3 An update never discards unacknowledged financial transactions.
- I4 An update never overwrites newer local data with older server data.
- I5 An update never requires downloading the whole workspace.
- I6 A failed update leaves the last known-good runtime usable.
- I7 Offline license state remains valid under existing rules.
- I8 Failed update checks never disable normal business operation.
- I9 An installed compatible module keeps working offline.
- I10 Module activation never triggers a full dataset download.
- I11 Activation is deferred while financial operations are in progress or while a schema transition is unsafe.
- I12 Update artifacts downloaded online can be activated later while offline.
- I13 Disabling a module (entitlement revoked, trial ended) keeps its data intact and readable by Core where applicable.

Test method: take a content hash snapshot of local DB tables and outbox before and after every update scenario, including every crash point (section 13.2), and assert equality.

---

## 12. USER EXPERIENCE

Simple default view: current status, "update available / up to date / restart needed", progress, last successful update. Advanced diagnostics view: Core/Bootstrap/module versions, channel, compatibility status, verification status, failure details, rollback status, storage usage, release notes, manual check, pause/resume, retry, per-module update, update compatible modules together, manage optional modules.

Rules: use existing `packages/ui` and design tokens; no hardcoded strings or colors; full i18n in `fa-IR`, `fa-AF`, `en`; RTL with logical CSS; accessible controls; show only real progress (never fake progress); never block active financial work with a modal.

---

## 13. TESTS AND GUARDS (THE PART THAT PREVENTS REPEATED DEBUGGING)

Every item here is required. Tests are written together with each slice and executed once in the Final Verification Gate.

### 13.1 Test layers

1. **Unit (pure core):** SemVer and range handling, manifest schemas, canonical JSON, signature/hash verification, state machine table, cohort bucketing, policy engine, dependency resolver, compatibility resolver.
2. **Property-based tests** (use the project's existing property-testing library if any; otherwise add a minimal dev dependency and record it): random manifests never crash the validator; version ordering is a total order consistent with SemVer; dependency resolver is deterministic and never returns a cyclic or incompatible set; cohort assignment is stable and monotonic as percentage grows; archive extractor never writes outside the target directory for any generated path.
3. **Fuzz/negative corpus:** malformed manifests, truncated archives, zip-slip, symlink entries, reserved Windows names, oversized archives, wrong-key signatures, valid signature over modified payload, expired metadata, replayed old sequence, downgrade attempts, hash mismatch, mutable-URL substitution. All must be rejected with a specific error code and no partial state.
4. **Adapter contract tests:** one shared suite run against the in-memory fakes and against each real adapter that can run in CI (Electron file store, mobile store where runnable). Adapters that cannot be exercised here are marked `UNVERIFIED_ON_DEVICE` with the exact manual steps in `SELF-UPDATING-VERIFICATION.md`.
5. **Backend integration:** control plane endpoints, entitlement gating, cohort/ring logic, halt/kill-switch, tenant isolation, unsupported-client responses, against real PostgreSQL where the data layer is involved.
6. **Simulation tests:** fleet simulation for staged rollout and auto-halt.
7. **End-to-end smoke:** web (existing E2E tooling, stale-tab and chunk-failure scenarios); Electron (existing tooling if present); Android only if runnable here, otherwise documented manual verification. Never report an E2E result you did not run.

### 13.2 Crash-point enumeration (mandatory)

Instrument every step boundary in the update algorithm (section 8.2) with a named crash point. A harness runs the full update once per crash point, simulating process death at that exact point (and, separately, fault injection: ENOSPC, EIO, partial write, rename failure, network cut mid-stream, corrupt range response, timeout). After each simulated death it restarts the Bootstrap logic and asserts:

- A1 the active slot is either the previous known-good version or a fully verified and health-confirmed new version, never partial;
- A2 no unverified artifact is loadable;
- A3 local data and outbox are byte-identical to before (section 11 method);
- A4 the system converges: re-running reaches ACTIVE or a stable rolled-back state with no loop;
- A5 the failure reason is recorded.
  The set of crash points is checked against an explicit list in the test file (not derived from the registry being tested), so adding a step without a crash point fails the suite.

### 13.3 Compatibility matrix tests (generated, then spot-checked by hand)

old Bootstrap + new Core; new Bootstrap + old Core; old Core + new module; new Core + old module; old API + new client; new API + old client; old local schema + new runtime; new local schema + old runtime. For each: expected outcome (works / refuse / safe mode) defined by hand in the spec, then asserted. Define the supported compatibility window in `UPDATE-COMPATIBILITY-MATRIX.md`.

### 13.4 Bug-class ledger (every row needs a named regression test)

1. Lexicographic version comparison ("1.10" vs "1.9").
2. Wrong device clock causing metadata to look expired or not-yet-valid; installed version must keep working.
3. CDN or proxy returning a stale manifest (rely on sequence/timestamp, not HTTP caching).
4. Resumed download with changed server content (validate ETag/hash; restart cleanly).
5. Zip-slip, symlink, case-collision, reserved Windows names, long paths.
6. Rename blocked by antivirus/indexer on Windows (bounded retry then safe failure).
7. Rename across volumes not atomic.
8. Two app instances or two tabs updating simultaneously (lock).
9. Update interrupted by sleep, shutdown, or low battery.
10. Update arriving while logged out, during trial expiry, or with an expired license.
11. Multiple workspaces/users on one device.
12. Legitimate rollback vs downgrade attack (signed directive with higher sequence).
13. Rollback target incompatible with newer DB contract or local schema.
14. Healthy app rolled back because the backend was down.
15. Rollback/update loop after repeated failures.
16. Module update whose dependency range is unsatisfiable or creates a cycle.
17. Module attempting to declare its own permissions or capability.
18. Optional module imported by Core (static import graph gate).
19. Native dependency or permission added without updating the compatibility fingerprint.
20. OTA published for a runtime version that does not match the installed native runtime.
21. Cohort flapping (device switching in and out of a ring).
22. Halt triggered by a tiny sample, or never triggered because of a missing minimum-sample edge case.
23. Missing i18n keys for update messages in any of `fa-IR`, `fa-AF`, `en`; RTL layout breakage.
24. Update UI showing progress or status that does not reflect real state.
25. Telemetry queue growth while offline (bounded, drops oldest non-critical first, never blocks the app).

### 13.5 Quality gates (CI-style repository checks)

Implement or extend existing checks for: Core importing optional modules; circular module dependencies; invalid manifests; dependency cycles; incompatible version ranges; missing signatures; invalid artifact hashes; unsupported platform delivery; missing rollback metadata; unsafe migration references; missing API compatibility declarations; missing translations; missing lifecycle tests; unprotected module permissions; unverified artifacts; incompatible `runtimeVersion` configuration; stale update metadata; missing previous-version recovery; accidental native dependency introduction; update-architecture regressions.

**Test the gates:** every gate ships with a seeded-violation fixture proving it fails when it should, and a clean fixture proving it passes. A gate that has never been shown to fail does not count. Expected coverage lists are written by hand, never derived from the registry under test. Avoid noisy static analysis.

### 13.6 Mutation check on the critical logic

Run a mutation-testing pass limited to: signature/hash verification, SemVer/range logic, state machine, compatibility resolver, rollback decision, cohort/halt logic, archive extractor. Surviving mutants in these files are treated as missing tests: add tests and re-run only those files. If a mutation tool is not installed, record the decision rather than skipping silently.

### 13.7 Determinism and flake policy

No real time, randomness, or network in unit/simulation tests (inject Clock, seeded RNG, fake Transport). The new suites run three times in the final gate; any flake is a defect to fix, not to retry.

---

## 14. IMPLEMENTATION SLICES (IN THIS ORDER; TESTS INCLUDED IN EACH SLICE)

- **S0** Baseline, evidence, owner-decision register, capability matrix draft.
- **S1** `updater-core` pure package: SemVer, ranges, manifest schemas, canonical JSON, verifier, trust model, state machine, policy engine, dependency and compatibility resolver, slot store logic, crash-point hooks, in-memory fakes, shared test harness. This slice carries the largest share of tests.
- **S2** Control plane: DB migration files + VERIFY SQL + pg tests, Fastify endpoints, entitlement and tenant isolation, rings, cohorts, halt and kill switch, signed metadata issuance interface (signing itself stays in the release environment; provide a release-signing CLI/script that reads keys from an external location and never stores them in the repo).
- **S3** Web adapter: version-skew detection, chunk-failure retry, stale-tab handling, deferral during financial operations.
- **S4** Electron adapter: slot store, protocol loader with CSP, restricted IPC, shell updater integration, Windows file-system edge cases.
- **S5** Android adapter: expo-updates integration (or the verified existing mechanism), runtime compatibility fingerprint, native-boundary refusal, offline fallback.
- **S6** UI in `packages/ui` plus app integration, i18n, RTL, accessibility.
- **S7** Real module proof: pick one real existing Hisabche capability that the dependency graph shows is separable (record why it was chosen). Extract it behind the typed extension contracts (navigation, routes, widgets, permissions, reports, workflows, forms, validation, localization, background jobs, API registration, sync operations, local schema, industry configuration). Then demonstrate through the implemented architecture: install, update to a new version, fail a bad version and roll back, offline use. Measure how many unrelated files had to change to add it. Do not claim extensibility 10/10 without this real end-to-end proof.
- **S8** Quality gates with seeded fixtures, bug-class ledger tests, documentation, `CLAUDE.md` / `AGENTS.md` updates, independent gap audit.

---

## 15. FINAL VERIFICATION GATE (RUN ONCE, AFTER ALL SLICES)

Run in this order, saving outputs under `docs/audits/evidence/`:

1. Typecheck for all changed packages.
2. Lint for changed packages.
3. New suites (`updater-core`, control plane, adapters, gates, simulation, crash-point, compatibility matrix, bug-class ledger).
4. Real PostgreSQL tests for new migrations and `VERIFY-*.sql`.
5. Suites of every package that depends on files you modified.
6. The full existing test suite once.
7. Production builds of web, Electron renderer, and Android JS bundle; record sizes before and after.
8. Mutation pass on the critical files (13.6).
9. New suites a second and third time (13.7).
10. Independent gap audit using these methods and recorded in `docs/audits/SELF-UPDATING-GAP-AUDIT.md`: update dependency graph (Bootstrap → Core → modules → shared dependencies → API → DB → local engine; find hidden hard dependencies, cycles, modules that cannot update independently, shared dependencies forcing full updates, native dependencies forcing binaries); compatibility matrix review; failure injection review; security bypass attempts (signature, version compatibility, module authorization, channel restrictions, artifact origin, rollback protection, permissions, tenant boundaries); offline review (download online and activate offline, long offline periods, pending financial transactions during update, re-login after update, module update with pending outbox, failed update and offline recovery); size and performance review (prove whether updates transfer only changed artifacts or full packages; do not claim delta updates unless artifact generation and transfer actually support them).

If anything fails, fix it, re-run only the failed suites and their direct dependents, then do a single last full run.

---

## 16. DOCUMENTATION AND PERMANENT RULES

Create real (non-empty) documents:
`docs/architecture/SELF-UPDATING-BASELINE.md`, `SELF-UPDATING-ARCHITECTURE.md`, `UPDATE-COMPATIBILITY-MATRIX.md`, `UPDATE-MANIFEST-SPEC.md`, `UPDATE-LIFECYCLE.md`, `MODULE-ARCHITECTURE.md`, `UPDATE-SECURITY.md`, `UPDATE-ROLLBACK-AND-RECOVERY.md`, `API-DATABASE-COMPATIBILITY.md`, `ADDING-AN-UPDATEABLE-MODULE.md`, `OWNER-DECISIONS.md`, `docs/audits/SELF-UPDATING-GAP-AUDIT.md`, `docs/audits/SELF-UPDATING-VERIFICATION.md`.
Update `CLAUDE.md`, `AGENTS.md`, `PROGRESS.md`, preserving useful existing instructions.

Add this mandatory algorithm to `CLAUDE.md` and `AGENTS.md` for every future change to application functionality:
DISCOVER (inspect real code, contracts, versions) → CLASSIFY (Native Bootstrap / Core Runtime / Optional Module / Industry Pack / Asset-Data Pack / Backend / Database) → COMPATIBILITY (Bootstrap, runtime, API, DB, modules, offline devices) → CONTRACT (typed interfaces, version requirements, permissions, migrations) → IMPLEMENT in the smallest correct boundary → PACKAGE only artifacts of the changed layer → VERIFY (signatures, hashes, compatibility, offline behavior, rollback) → ROLLOUT through channels and rings → OBSERVE → RECOVER → PREVENT (regression test and gate for every new failure class).

Permanent rules: a compatible Core or module change must not force a full application installation; if a native change needs a new binary, document the technical reason and use the platform's supported update path; no one may silently add a native dependency or runtime requirement without updating the compatibility model and fingerprint.

---

## 17. ACCEPTANCE AND HONEST SCORING

A requirement counts as met only with executed evidence. Produce a table of these requirements with status `MET_VERIFIED`, `MET_NOT_VERIFIED`, `PARTIAL`, `NOT_MET`, or `NEEDS_OWNER_DECISION`, each pointing to an evidence file:

Bootstrap/Core separation; independent Core version; independent module versions; one control plane; manifest validation; artifact integrity; trusted signatures; compatibility enforcement; safe staging; atomic activation; rollback proven by crash-point and failure-injection tests; user data preserved; pending offline operations preserved; API compatibility; DB compatibility; Windows in-app updates; web compatible updates; Android OTA for compatible JS/assets; native Android changes via approved binary path; no unnecessary full updates; observable lifecycle; channels plus staged rollout plus auto-halt; existing business workflows intact (full suite result); independent audit completed; permanent rules in `CLAUDE.md`/`AGENTS.md`; quality gates tested with seeded violations; no production data or deployment touched.

Scores (extensibility, update reliability) are computed from this table with the formula written in the report, not asserted. Extensibility 10/10 requires the real module proof from slice S7. Update reliability 10/10 requires all crash-point, compatibility, security, and simulation suites passing in the final gate, with the platforms that could not be exercised listed as `UNVERIFIED_ON_DEVICE` with manual steps.

Final status is exactly one of: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_FULLY_VERIFIED`, `PARTIALLY_COMPLETE`, `BLOCKED`.

Never claim: zero-manual-update on a platform requiring a binary update; a working rollback without an executed failure-and-recovery test; an independently updating module whose shared dependency forces a full release; delta updates without real delta artifacts; zero downtime without evidence.

---

## 18. FINAL REPORT FORMAT

1. HEAD before and after. 2. Baseline findings and measurements. 3. What each layer implements (Bootstrap, Core, modules, control plane, manifests, signatures, compatibility). 4. Platform behavior (Windows, web, Android) and native limitations. 5. Rollback and recovery behavior. 6. Staged rollout and auto-halt behavior with simulation results. 7. DB and API compatibility. 8. Offline update behavior. 9. Size and transfer measurements before/after. 10. Performance measurements. 11. Tests executed with exact commands and real results. 12. Mutation results. 13. Independent defects found, fixed, and remaining. 14. `NEEDS_OWNER_DECISION` list. 15. `UNVERIFIED_ON_DEVICE` list with manual steps. 16. Quality gates added and their seeded-violation proofs. 17. `CLAUDE.md` / `AGENTS.md` changes. 18. Requirement table and computed scores. 19. Final status.

START WITH SLICE S0. INSPECT THE ACTUAL REPOSITORY. IMPLEMENT THE ARCHITECTURE IN THE EXISTING SYSTEM. DO NOT STOP AT DOCUMENTATION.
