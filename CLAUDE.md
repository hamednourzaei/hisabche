# Hisabche — Session Guide

> This file is loaded **automatically** every session. It is intentionally concise: a map, not an encyclopedia.
> **Fundamental Principle:** The `AGENTS.md` file in the repository root is the canonical and single source of truth for all rules, engineering discipline, Preflight, and Postflight. Claude Code is strictly required to observe all clauses of `AGENTS.md`.
> Full details of the code intelligence protocol and CLI/MCP tools are documented in `docs/ai/CODE-INTELLIGENCE-WORKFLOW-GUIDE.md`.

Persian/Dari accounting and ERP software. Monorepo with pnpm + Turbo.

---

## 0. Mandatory Preflight & Code Intelligence V3.0

Before inspecting code, planning, or making any edit (applies to Claude Code, Cursor, OpenCode, Codex, Antigravity):
1. **Git Check & Preserve User Work:** Run `git status --short`. Never run `commit`, `push`, `reset`, or `stash`. User work in progress in the working tree must remain untouched.
2. **Ensure Fresh Index (`prepare`):** Run `pnpm code-intel prepare` (or MCP `code_intel_status`). If `STALE` or `MISSING`, refresh with `pnpm code-intel update` first so every harness shares a current index.
3. **One-Call Bounded Discovery (Zero Hallucination):**
   - Get a task context pack (`<= 4000` tokens): `pnpm code-intel context-pack "<task>"` or MCP `code_intel_get_context_pack`.
   - Map a vertical slice: `pnpm code-intel feature "<name>"` or MCP `code_intel_feature`.
   - Search concepts/errors (FA/EN + BM25): `pnpm code-intel search "<query>"` or MCP `code_intel_search_code`.
   - Find symbols / callers / impact: `symbol find <name> [--returns <type>]`, `symbol show <id>`, `callers <id>`, `impact <target>`, `source <id>`.
4. **Extend Rather Than Duplicate (Rule 2):** If a service, schema, hook, or component exists, extend it. Never create a duplicate module.
5. **Mandatory Post-Edit Index Update:** After finishing edits in **any** prompt/task, run `pnpm code-intel update` so the next agent or harness immediately sees fresh state.

---

## 0. Execution Constraints — Before Any Action

**Never run DDL or any write directly against the live Supabase database.**
You produce only two files: (1) Migration file under `docs/` — additive, idempotent, with a Rollback/Mitigation block; (2) A separate Verification Query. A **human** executes them in the SQL Editor.

Until actual execution results are confirmed by a human, never write "Post-migration Audit: PASS".
Write: `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`.

---

## 0.5. Working Method — Constant Requirements of the Project Owner

- **Do not commit or push.** The project owner commits and pushes himself.
- **Do not create subagents.** Perform the task directly yourself.
- **Do not run builds** until all work is completed, and do not ask "which phase" midway through the task.

---

## 0.6. Permanent Standard for Outcome-Driven System Integrity

> **Permanent Rule:** A live service, HTTP 200 response, or green unit test alone is not proof of capability correctness.
> Every Hisabche capability must satisfy all 5 layers: (1) Availability, (2) Execution and Replay Prevention, (3) Outcome Correctness and Financial Integrity, (4) Durability in Database, Outbox, and Offline Sync, (5) Accurate User-Visible Rendering.
> Reference: `.agents/skills/outcome-driven-system-integrity/SKILL.md`, Section 0.7 in `AGENTS.md`, and `docs/architecture/OUTCOME-DRIVEN-INTEGRITY-STANDARD.md`.
- **Backend, Web, Windows, Mobile, and Supabase scripts finish together.**
- Finishing sequence for each round: Full verification → ESLint on modified files (from that package's directory) → Builds → Document lessons in `.claude/` and this file → Persian report with tables and actual measured numbers.
- Permitted final report statuses: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` · `NOT_APPLICABLE` · `FAILED`.
  Without real HTTP or live database verification, nothing is `VERIFIED_COMPLETE`.

Details: `.claude/skills/hisabche-session-rules/SKILL.md`.

---

## 0.6. Single UX — Hubs (October 5 "Before / After" Comparison Concluded)

The project owner chose "After". The "Before" switch, `useUxVersion`, `visibleInUx`, and `ux:` fields **have been removed** — do not reintroduce them (Guard: `packages/ui/src/__tests__/one-ux.test.ts`).

- **Every page is a hub:** Tabs on top (`HubTabs`/`PageHub`), underneath only **one** switch (`SegmentedControl`), one section on screen. Tab is in `?tab=` and section is in `?view=`.
- **A route sharing data with a page becomes a tab or section of that same page** — not a new route, not a menu item.
- **Legacy URLs do not die:** A page converted to a section receives an entry in `moved` (`apps/web/next.config.js`) and the exact matching `<Navigate>` in `packages/app-shell/src/app/app.tsx`. The two lists must remain identical (Guard: `route-parity.test.ts`). 31 pairs exist; 19 web page directories were deleted.
- **Section lock = Lock of its legacy page.** Keys like `/bank` and `/expiry` remain in `NAV_MODULE` even though they are no longer in the menu — `isNavLocked(source)` hides the section using them. Removing them = displaying the section to a user whose module is locked. Closed list in `nav-module-locks.test.ts`.
- **Link to section using hub URL:** `/accounting?tab=treasury`, not `/bank` (work queue, help, `entity-route`). A query-carrying key in `ROUTE_DOCS_MAP` is strictly for "Open in App" and never matches pathname.
- ⚠️ `/sync-center` deliberately remains a standalone page: on Windows, it is the device's own outbox queue page (`features/sync/sync-page.tsx`), not the shared container.

Details: `.claude/SESSION-CACHE-2026-10-05-UX.md` · skill `hisabche-ux-consolidation`.

---

## 1. Five Rules Everything Rests On

1. **`workspace_id` is the only security boundary.** `user_id` denotes who acted and is **never** a filter. Services accept a `TenancyContext`, not a `userId`.
2. **Read role from `request.tenancy.role`, never `request.userRole`.** The latter is empty for multi-workspace users. A role sent to the browser is client-mutable and used for display only.
3. **Money is integer minor units on the money path. No floats.** The server derives amounts from line items, never trusting client-submitted totals.
4. **supabase-js has no transactions.** Multi-table writes must be PostgreSQL functions invoked via `.rpc()`. Compensating `DELETE` operations are strictly forbidden.
5. **A green test is not proof.** Proof requires real HTTP (`buildServer()` + `app.inject`) or real PostgreSQL (`*.pg.test.ts` with embedded-postgres).

---

## 2. Guardrails

- **G1 — No UI Theater:** No mockups, no fake APIs, no dummy data. Real data, or an explicit empty state.
- **G2 — No Parallel Architecture:** Find existing code and extend it. Never create a second model, store, service, or component beside the first.
- **G3 — No Destructive Migrations:** Additive, idempotent, and re-runnable.
- **G4 — No Undefined Policy:** Every setting must have an explicit default value.
- **§12 — No Guessed Backfill:** Old incomplete data stays `Unknown`. Guessing roles or amounts fabricates facts about real people.
- **§13 — No Silent Fixes:** Report first, then remediate.
- **§14 — No Dead Code:** Misunderstood requirements? Discard the code completely, do not keep it dormant.

---

## 3. Structure

```
backend/          Fastify + supabase-js + zod + vitest
packages/
  api             React Query hooks ← asList() lives here
  ui              All shared components (shared Web + Desktop)
  ui-contract     Status / list / view / work queue contracts + DateRange
  validation      Zod schemas + domain rules
  formatting      Money, dates, digits, CSV ← the only place for formatting
  store           Zustand ← setOnUnauthorized wired here
  i18n            messages/{fa,af,en}/common.json
  auth-core       Session model and roles
apps/
  web             Next.js 16 App Router, [lang] prefix
  desktop         Electron + react-router (hash), shims for next-*
  mobile          Expo + WebView on app-shell (same packages/ui), Jest — pnpm run build:shell
  admin           Platform administration panel
docs/             SQL files + reports. Migrations are created here.
```

---

## 0.6. Codebase Navigation Intelligence V3.0 — Permanent Cross-Harness Rules

### Canonical Index Artifacts (`.ai/codebase/`)
Four artifacts in `.ai/codebase/` form the **single source of truth** across **every coding agent and AI harness** (Antigravity, Claude Code, Cursor, OpenCode, Codex):
- `CODEBASE_MAP.md` — Human-readable architecture map (<300 lines)
- `graph.json` — Compiler-backed AST symbol and relationship graph (`domain`, `platform`, `layer`, `fileHash`, `isTest`)
- `cache.json` — Full-manifest SHA-256 fingerprints & config hashes (`tsconfig*`) for exact staleness detection & incremental updates
- `lexical.json` — BM25 full-text & Persian/English concept synonym inverted index

Full build: `node scripts/build-ai-index.mjs --full` · Incremental update: `pnpm code-intel update` · Diagnostics: `pnpm code-intel doctor` · Auto-wire MCP: `node scripts/setup-mcp.mjs` (`--global` for user configs).

### Rule 1: Prepare & Cache-First (`prepare` at start)
1. At the start of **every** task in any harness, run `pnpm code-intel prepare` (or MCP `code_intel_status`). If `STALE` or `MISSING`, refresh via `pnpm code-intel update` before querying.
2. Start discovery with `pnpm code-intel context-pack "<task>"` (<= 4000 tokens), `pnpm code-intel feature "<name>"`, or `pnpm code-intel search "<query>"` instead of wide `grep` or reading whole files.
3. Never read `.env*`, `.pem`, `.key`, or secret files; if retrieval returns `INSUFFICIENT_EVIDENCE`, fall back strictly to scoped `rg -n "exact_symbol" <target-package>`.

### Rule 2: Bug Resolution Protocol (Stack-Trace & Symbol Jump)
When a bug, error message, TypeScript diagnostic, or crash is reported:
1. **If `file:line` is in stack trace:** Open that exact file and line **first**. Zero exploration.
2. **If error string or symbol is provided:** Run `pnpm code-intel search "<error>"` or `symbol find <name> [--returns <type>]` via the single query core instead of scanning unrelated domains.
3. Trace only the minimal subgraph (`callers` / `callees` / `impact --depth 2`): `Failing File -> Direct Caller -> Direct Callee -> Schema/Type -> Platform Adapter`.
4. **Hard Read Limit:** Open **at most 5 source files** (use `source <id>`) before identifying the root cause.

### Rule 3: Feature Resolution Protocol
When adding or modifying a capability:
1. Run `pnpm code-intel feature "<name>"` or `context-pack "<task>"` to inspect schema -> backend -> api -> ui -> mobile -> tests and verify `domain`/`platform`/`layer` (`SHARED` vs `WEB_ONLY` vs `MOBILE_ONLY` vs `WINDOWS_ONLY` vs `SERVER_ONLY` vs `PLATFORM_ADAPTER` vs `OFFLINE_ENGINE`).
2. Check existing hooks/services/Zod schemas/components (**Reuse > Extend > Duplicate**, Rule 2).
3. Business rules must reside in shared/domain packages; platform-specific code must remain a thin adapter.
4. Keep edits minimal and bounded (`PRIMARY FILES` first; `SECONDARY FILES` only if data contract changes).

### Rule 4: Mandatory Cross-Harness Update After Every Prompt / Task
1. **After finishing edits in ANY prompt or task, EVERY harness (Antigravity, Claude Code, Cursor, OpenCode, Codex) MUST run `pnpm code-intel update`** and confirm `pnpm code-intel status` reports `FRESH`.
2. Never manually edit `graph.json`, `cache.json`, or `lexical.json`. Never claim `fixed`, `verified`, or `production-ready` without executing real checks. Label statuses honestly (`VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `VERIFIED_WITH_LIMITATIONS`, `BLOCKED`).

---

`fa`, `af`, and `en` are all **active**. Every new key must exist in **all three** —
calling `t()` on a missing key **throws** and crashes the page into an error boundary.

---

## 4. Project Knowledge — Where to Look

| Question / Topic | File |
| --- | --- |
| **Blog: map, traps, decisions (26 Sep)** | `.claude/SESSION-CACHE-2026-09-26-BLOG.md` |
| **Binary sync, barcode/print, DB performance, Cloudflare (27 Sep)** | `.claude/SESSION-CACHE-2026-09-27.md` |
| **Business OS 150 capabilities: roadmap, phasing, lessons (30 Sep)** | `.claude/BUSINESS-OS-SPEC.md` · `BUSINESS-OS-EXECUTION.md` |
| **Business OS Phase 0–4 lessons (30 Sep)** | `.claude/SESSION-CACHE-2026-09-30-BUSINESS-OS.md` |
| **🔴 Open findings — read first** | `.claude/SESSION-CACHE-2026-09-30-FINDINGS.md` |
| **Wallet, product image, marketplace, refresh token, Dari (3 Oct)** | `.claude/SESSION-CACHE-2026-10-03.md` |
| **Business OS: which engines are wired; duplicate invoice (4 Oct)** | `.claude/SESSION-CACHE-2026-10-04-BUSINESS-OS-WIRING.md` |
| **Analysis page, unwired capabilities and reasons (4 Oct)** | `.claude/SESSION-CACHE-2026-10-04-BUSINESS-OS-WIRING.md` — Round 2 |
| **Manufacturing: model, roadmap, what wasn't built (4 Oct)** | `.claude/SESSION-CACHE-2026-10-04-MANUFACTURING.md` |
| **Gap Closure: price lists, late fees, OCR, translation, shifts, dashboard** | `.claude/SESSION-CACHE-2026-10-04-BUSINESS-OS-WIRING.md` — Round 5 |
| **UX Review: one page per file, merge proposals (4 Oct)** | `.claude/ux-audit/README.md` · `00-PROPOSAL.md` |
| **Hubs, branch lines, payroll/leave, sandbox 403 (5 Oct)** | `.claude/SESSION-CACHE-2026-10-05-UX.md` · BUG-097..099 in `BUG-REGISTRY.md` |
| **AI Pipeline: gaps, roadmap, implementation status (6 Oct)** | `.claude/ai-pipeline/00-GAP-AND-PLAN.md` · `01-STATUS.md` |
| **Profit, cost of goods, trial balance: "Unknown is not zero" (11 Oct)** | `.claude/accounting-integrity/00-SPEC.md` · `SESSION-CACHE-2026-10-11-INTEGRITY.md` |
| **Database integrity: eight rules, phases, FINDING output (11 Oct)** | `.claude/db-integrity/00-SPEC.md` · `docs/db-integrity-01-migration.sql` |
| **Books currency and multi-currency audit; file import (11 Oct)** | `.claude/reverse-and-import/01-CURRENCY-AUDIT.md` · `00-SPEC.md` |
| **Antigravity review: multi-currency till, events, attendance link (12 Oct)** | `.claude/SESSION-CACHE-2026-10-12-ANTIGRAVITY-REVIEW.md` · `AGENTS.md` |
| **Live audit 14 Oct: 82 bugs, lessons, pending human confirmation** | `.claude/LIVE-AUDIT-2026-10-14.md` · `.claude/SESSION-CACHE-2026-10-14-LIVE-AUDIT.md` |
| **100 Promo reels: layering, templates, 49 business types (23 Oct)** | `hisabche-promo-reel/docs/100-VIDEO-PLAN.md` · `SESSION-CACHE-2026-10-23-100-VIDEOS.md` |
| **3D Landing realism pass: 6 of 12 sections (23 Oct)** | `docs/SCENE-REALISM-AUDIT.md` · `docs/DECISIONS.md` |
| **Master user journey from landing to ledger; 31 gaps (7 Nov)** | `docs/product/HISABCHE_MASTER_USER_JOURNEY.md` · `HISABCHE_WORKFLOW_GAPS_AND_BLOCKERS.md` |
| **In-app guide: based on active features; tabs from URLs; 79 steps (15 Nov)** | `docs/architecture/V67-GUIDES-DOCS.md` · Lesson 263 |
| **160 Antigravity bugs verification against code (7 Nov)** | `docs/audit/AUDIT-80-VERIFICATION.md` |
| **V54 Phase 5.0 audit with code (DNA on device; bookings/deposits) (7 Nov)** | `docs/architecture/UNIVERSAL-BUSINESS-ARCHITECTURE.md` · `V54-IMPLEMENTATION-PROGRESS.md` |
| **V54 Execution: session attendance moves, versioned DNA, onboarding (7 Nov)** | `docs/architecture/V54-IMPLEMENTATION-PROGRESS.md` § Round 2 |
| **V54 Round 3: proforma sales/purchases, OTP, commission, deposits (8 Nov)** | `docs/architecture/V54-IMPLEMENTATION-PROGRESS.md` § Round 3 |
| **One-time guide (server), spotlight, unit filter, proforma invoices (8 Nov)** | `.claude/lessons-learned.md` Lessons 251–252 |
| **Architecture audit 8 Nov (12 docs) and remediations (9 Nov)** | `docs/audit/HISABCHE-MASTER-AUDIT-INDEX.md` · `docs/audit/HISABCHE-FIXES-2026-11-08.md` |
| **UX Round 9 Nov: proforma in invoice builder, custom dashboard, break-even** | `.claude/lessons-learned.md` Lesson 255 |
| **QA Report 9 Nov: database drafts, waste, packaging conversions, serials** | `docs/product/QA-2026-11-09-RESPONSE.md` · Lesson 256 |
| **Industry packages on universal core: clothing, transfers, exchange (10 Nov)**| `docs/product/QA-2026-11-09-RESPONSE.md` § Round 2 · Lesson 257 |
| **V61/V63 Audit: 500 errors, gateway form, TV wall, 113 items (12 Nov)** | `docs/architecture/V61-IMPLEMENTATION-PROGRESS.md` · `V63-IMPLEMENTATION-PROGRESS.md` |
| **V61 Owner decisions: seller is member, unified approvals (12 Nov)** | `docs/architecture/V61-IMPLEMENTATION-PROGRESS.md` §0.2 |
| **V60 Audit with code and V64 "Sellable" prompt (12 Nov)** | `docs/architecture/V60-IMPLEMENTATION-PROGRESS.md` · `docs/architecture/V64-PROMPT.md` |
| **V68/V69: local-first execution, 67 industry profiles (16 Nov)** | `docs/architecture/V68-V69-PROGRESS.md` · `V70-BACKLOG.md` · `docs/industries/README.md` |
| **All numbered lessons (1–265)** | `.claude/lessons-learned.md` |
| **Dari glossary (af) — for every new key** | `.claude/DARI-GLOSSARY.md` |
| **Diagnostic queries for live database** | `docs/FINDING-*.sql` · `docs/TEST-A-BEFORE.sql` |
| **Business OS bugs (BOS-01 to BOS-15)** | `.claude/BUG-REGISTRY.md` |
| **API keys, webhooks, bank statements, ecosystem comparisons** | `.claude/research/ecosystem-gap-analysis.md` |
| **Recent session lessons and bugs (19 Sep)** | `.claude/SESSION-CACHE-2026-09-19.md` |
| **Bug registry with root causes and guards** | `.claude/BUG-REGISTRY.md` |
| **Performance, PageSpeed, mobile landing (15 Sep)** | `.claude/SESSION-CACHE-2026-09-15-PERF.md` |
| **Open user requests** | `.claude/USER-REQUESTS.md` |
| **Debug playbook / how to verify** | `.claude/DEBUG-PLAYBOOK.md` |
| **Why it was built this way** | `.claude/lessons-learned.md` |
| **What works and what doesn't** | `.claude/STATE.md` |
| **Where new code belongs** | `.claude/architecture/core-modules.md` |
| **Which hook maps to which endpoint** | `.claude/architecture/api-surface.md` |
| **Database tables and RLS** | `.claude/architecture/data-model.md` |
| **Source of Truth / Which migrations were executed** | `.claude/SESSION-2026-09-05-CONSOLIDATION.md` |
| **Workflow for migrations, tests, and commits** | `.claude/WORKFLOW.md` |

---

## 5. Skills & Available Tools

**Skills** (`.claude/skills/`) — `hisabche-` + one of:
`architecture` · `auth` · `backend` · `code-review` · `database` · `debugging` ·
`desktop` · `i18n` · `lessons` · `mobile` · `offline` · `testing` · `ui` · `web`

And the workflow coordination skills — **read `session-rules` first in every session**:

| Skill | When to Use |
| --- | --- |
| `hisabche-session-rules` | Start of each session & before ending turn: forbidden items, order, report format |
| `hisabche-feature-delivery` | Every "add / wire / build": from DB to three platforms |
| `hisabche-migrations` | Before creating any `docs/*-migration.sql` |
| `hisabche-scripted-edits` | Before multi-file edits, i18n additions, or scripts with backslashes/backticks |
| `hisabche-release-build` | Only after ALL work is complete: verify, lint, builds |
| `hisabche-ai-and-integrations`| AI, email, MCP, reading docs, external connectors |
| `hisabche-ux-consolidation` | Before analyzing a page, proposing UX changes, adding routes, or merging screens |

---

## 6. Verification Commands

```bash
cd backend        && npx tsc --noEmit && npx vitest run
cd packages/ui    && npx tsc --noEmit && npx vitest run
cd packages/api   && npx tsc --noEmit
cd apps/web       && npx tsc --noEmit
cd apps/desktop   && npx tsc --noEmit && npx jest
cd apps/admin     && npx tsc --noEmit
```

---

## 7. Five Repeated Pitfalls

Test suspicious code against these patterns before debugging:

1. **"The rule exists but nobody calls it."** A pristine abstraction is implemented with zero callers. When you locate an abstraction, `grep` for actual usages first.
2. **"A type annotation is not a runtime check."** `(x ?? []).map is not a function` crashed two pages. Always pass API lists through `asList<T>()` in `packages/api/src/lib/as-list.ts`.
3. **"Error and empty collapsed into one branch."** `if (error || rows.length === 0) return empty` causes database errors to masquerade as "You have no data" with HTTP 200 and get cached. Keep error and empty strictly separated. Never cache errors.
4. **"Silently incorrect numbers."** Using `.limit(N)` or `count: 'estimated'` under financial aggregates computes metrics from a single page or planner guess. For authoritative decisions, use `count: 'exact', head: true` or `selectAllPages`.
5. **"Absence of an indicator is not an indicator."** Put notifications and warnings where the decision is made, not as the absence of an icon.
6. **"Empty states and permission denials render identically."** A query with `enabled: false`, a field missing from response, and a truly empty table look identical. When a user reports "it doesn't work" and console is silent, investigate this pattern first.

---

## 8. Technical Pitfalls

### Types & React
- `exactOptionalPropertyTypes: true` across the entire monorepo. `prop?: string` rejects an explicit `undefined`; write `prop?: string | undefined`.
- React 19: Reading `document` or `window` during render triggers hydration mismatch and unmounts the component tree. Only access browser globals inside `useEffect`.
- Hooks called after early returns break the Rules of Hooks. Guarded by `conditional-hook-call.test.ts`.
- `ReferenceError: Cannot access 'X' before initialization` indicates TDZ, almost always caused by a circular module import (e.g. importing from a package's own barrel). See `no-self-barrel-import.test.ts`.

### Styling & RTL
- Tailwind arbitrary values: Unescaped **spaces** inside `[...]` cause parse failures; use underscores `_` for spaces. Commas are completely valid (`grid-cols-[minmax(0,1fr)_...]`).
- Radix `asChild`/`Slot` accepts exactly one child; a conditional sibling breaks dropdowns.
- RTL: Use logical properties only (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`, `border-e`). Never `left` or `right`.
- ⚠️ **`start-*` is logical, while `translate-x-*` is physical.** `start-1/2` in RTL means `right: 50%`, but `-translate-x-1/2` moves strictly to the left. Combining them shifts the element by half its width. For centering, use full-width row with `inset-x-0 flex justify-center`. Guard: `bottom-nav-indicator.test.ts`.
- ⚠️ **`router.prefetch` requires actual localized route.** Prefetching `/invoices` when the app navigates to `/fa/invoices` prewarms nothing.
- Design tokens only: `hsl(var(--color-primary))`. Never hex codes or hardcoded Tailwind colors.

### Serialization & Data
- `fast-json-stringify` omits any field not explicitly named in the Fastify response schema, and coerces `null` on `{type:'string'}` into `""`. Nullable fields must be declared as `['string', 'null']`.
- Embeds in PostgREST (`table!left(...)`) resolve strictly against existing foreign keys. Verify with `pg_constraint`.
- `toJsonSchema` must be recursive.

### Calendar & Locale
- Calendars derive from language: `fa` → `fa-IR` (Iranian Solar Hijri), `af` → `fa-AF` (Afghan Solar Hijri), `en` → `en` (Gregorian).
- In UI components, use `useDateFormat()`; in modules, pass `lang` explicitly.
- Never store "current language" at module level on the server; Next.js serves multiple locales concurrently.
- `toIsoDay` is always Gregorian ISO (YYYY-MM-DD) for query strings and PostgreSQL storage.

### Desktop & Builds
- Electron packaged renderer loads via `file://`. An absolute path like `/logo.png` resolves to drive root `C:\`. Resolve paths using protocols.
- `${env.X}` in `electron-builder.yml` expands too early and breaks builds.
- ⚠️ Windows builds require `TMP`/`TEMP` = `C:\Users\hamed\Desktop\hisabche\.esbuild-tmp` because esbuild binaries fail to remove large temp files under `AppData\Local\Temp` (`Access is denied`).
- Set `nsis.packElevateHelper: false` to avoid Defender quarantine of `elevate.exe`.

### Web, SEO & API
- ⚠️ Every new header sent by `packages/api` must be added to `allowedHeaders` in `backend/src/index.ts` in the **same commit**.
- ⚠️ Server cache uses key `<keyPrefix>:<workspaceId or userId>:<url>`. After money, invoice, payment, or stock changes, call `invalidateMoneyCaches(workspaceId)`.
- Never use `.limit()` on queries feeding threshold alerts or business decisions.
- Internal links must always include the locale prefix. External links to private pages must use `rel="nofollow"`.
- Page titles should not hardcode the brand; the layout template adds `| Hisabche`.
- Every marketing claim must be backed by real code. Guard: `landing-claims.test.ts`.

### Token Readiness & Route Architecture
- ⚠️ `registerTokenGetter()` is called on import before Zustand persistence hydrates. Readiness must be signaled by the store via `markTokenReady()` after hydration. Guard: `token-ready-waits-for-hydration.test.ts`.
- ⚠️ Navigation in shared UI must strictly use `useLocalePush` / `useLocaleReplace` / `useRouteLang` + `localizePath` (`packages/ui/src/hooks/use-locale-push.ts`). Bare `router.push('/...')` in `packages/ui` is forbidden.
- ⚠️ Page structure: `apps/web/app/[lang]/(dashboard)/**/page.tsx` = metadata + `<XContainer />` from `@hisabche/ui`. Only `dashboard-layout.tsx` contains `<main>`.
- ⚠️ Never import shared constants from a service file (prevents module cycles). Place constants in standalone files with zero dependencies. Guard: `no-service-import-cycles.test.ts`.

### Sync, Device & Local-First (V68)
- Invoices are local-first. Execution location is determined by `executionSiteFor` based on local transport and prerequisite table sync (`deviceReadyFor`), not hardware class.
- Two pushers must never claim the same outbox row concurrently (`claimQueue` is atomic).
- Local payment posting mirrors server `bookPayment` line for line (`payment-posting-parity.test.ts`).

### Labels & Statuses
- A status value with two meanings causes misleading UI labels. E.g. `invoices.status = 'pending'` means unpaid, not awaiting approval. Labels must reflect actual domain state.
- Empty states must explain the reason (e.g. why no approvals exist vs. everything approved).
- Recorded events are not toggles.

### Server Errors
- ⚠️ `response.data.error` is the HTTP status name (e.g. 'Bad Request'), not the business reason. The reason is in `message` or `details[].path`. Always read via `apiErrorMessage()` from `@hisabche/api`. Guard: `error-reading-is-shared.test.ts`.
- Highlight fields rejected by the server using `apiErrorFields()` + `useServerFieldErrors()`.

### Business OS Engines
- "Wired" means reachable from a route, job, or worker — not merely mentioned in code. Verified by `unwired-capability.test.ts`.
- One unified job runtime: `distributed-work.ts` + `email-outbox.ts`.
- Unknown or missing quote must return `null`, not `0`.
- All monetary sums must be partitioned by currency or filtered to a single currency.
- Database migrations must be proven by executing twice against real PostgreSQL via `*.pg.test.ts`.

---

## 9. Testing Rules

- Source-assertion tests must strip comments before matching.
- Always perform injection testing on guards: temporarily revert the fix to verify that the guard fails, then restore it.
- Ensure every new i18n key exists across `fa`, `af`, and `en`.

---

## 10. Forbidden Actions

No random administrative actions · No unverified new features · No drive-by edits to unrelated files · No parallel duplicate architectures · No `any`, `@ts-ignore`, or `eslint-disable` · No dead code or unused imports · **Never claim PASS without verified real output**.

---

## 11. Final Response Format

Respond to the project owner in **Persian**, structured with:
1. **Status**: Standard status code (`IMPLEMENTED_NOT_LIVE_VERIFIED`, etc.)
2. **Files Changed**: Each path with a clear explanation of modifications.
3. **Measured Numbers**: Real test command outputs, exit codes, and counts.
4. **Scope Boundaries**: What was done and what was excluded.
5. **Assumptions & Human Action Items**: Required migrations and human steps.

---

## 12. Hisabche Engineering Agency

Specialized multi-team AI engineering agency (`hisabche-agency/`) built from `msitarzewski/agency-agents` (MIT), strictly subordinate to `AGENTS.md` and this file:

- **Maps & Governance:** `hisabche-agency/README.md`, `hisabche-agency/ORGANIZATION.md`, `hisabche-agency/GOVERNANCE.md`, `hisabche-agency/AGENT-REGISTRY.md`, `hisabche-agency/ORCHESTRATION.md`, `hisabche-agency/EVIDENCE-STANDARD.md`, `hisabche-agency/RELEASE-POLICY.md`.
- **Workflows (`hisabche-agency/workflows/`):** `architecture-audit`, `security-audit`, `database-audit`, `offline-sync-audit`, `mobile-audit`, `ux-audit`, `production-readiness`, `regression-testing`, `release-validation`.
- **Execution Discipline:** Always choose `LIGHTWEIGHT` | `STANDARD` | `CRITICAL` sizing (`ORCHESTRATION.md`), keep reviewers strictly read-only alongside existing `.claude/agents/{domain,parity,security}-reviewer.md`, never bypass `AGENTS.md §0` (no git ops, no live DDL, no `.env*`, no RN/Expo upgrades, no Redis/LWW on financial sync), and verify every installation update with `node hisabche-agency/scripts/verify-agency.mjs`.
- **Harness Locations:** User Antigravity plugin (`~/.gemini/config/plugins/hisabche-agency/`), user Claude Code agents (`~/.claude/agents/hisabche-*.md`), and pre-converted Codex TOMLs (`hisabche-agency/integrations/codex/agents/`).

---

## 13. Permanent Engineering Algorithm & Project Lessons (Mirrors `AGENTS.md §12`)

- **Pre-Implementation (10 Steps):** Inspect existing code -> identify single source of truth -> trace callers/consumers -> read schema/RPCs/migrations -> check RBAC/`workspace_id` -> check online/offline parity -> verify money units & `FRACTION_DIGITS` -> check existing tests -> define invariants -> write failing regression test first.
- **Post-Implementation (10 Steps):** Run targeted tests -> `tsc --noEmit` -> `eslint` (0 errors) -> `git diff --check` -> check for duplicates/bypasses -> verify API/DB/UI parity -> verify tenancy/RBAC -> verify `FOR UPDATE` + idempotency -> verify currency scale -> update `PROGRESS.md` & `pnpm code-intel update`.
- **Key Lessons Recorded:**
  - `SupabaseStorageProvider` auto-ensures missing private buckets; `backend/src/index.ts` exempts `GET .../brand-assets/.../content` from global JWT auth **only when non-empty `sig=` is present**; `BrandAssetService` derives a domain-separated HMAC subkey when symmetric `JWT_SECRET` is absent in ES256 deployments.
  - `packages/auth/src/supabase.ts` must access `process.env.NEXT_PUBLIC_*` directly for Next.js static inlining; `useRealtime`/`usePresence` gate on `hasToken() && !isOfflineTokenMode()` with a `50ms` StrictMode settle timer.
  - Payment final states (`captured`, `declined`, `voided`) require HMAC webhook or capability-gated `adminOverride` via `transition_payment_processor_state`; `cross-core-reconcile.ts` converts all major decimal amounts with `majorToMinor` and checks actual posted journal amounts; `create_project_change_order_v2` locks `projects FOR UPDATE` before idempotency checks and returns explicit `{ order, replay }`; `sweep_support_ticket_slas` uses `actor_id = NULL` (system) and tracks real `sent`/`failed` `notification_status`.
