# HISABCHE — UNIVERSAL CODE INTELLIGENCE SYSTEM

## Phase 0: Baseline & Safety Audit Report

**Date:** 2026-10-30  
**Git HEAD:** `b9f90056afad64cb1af2f634482ecb0110bf7030`  
**Git Status:** Clean (`0 uncommitted files`)  
**Auditor:** Antigravity AI Code Intelligence Layer  
**Scope:** Whole monorepo audit (`apps/`, `packages/`, `backend/`, `scripts/`, `docs/`)

---

## 1. Executive Summary

Hisabche is a monorepo encompassing **3,930 TypeScript/JavaScript files**, **355 SQL migrations**, **836 test suites**, and **22 workspace packages**.

Currently, coding agents rely on two artifacts for navigation:

1. **`.ai/codebase/CODEBASE_MAP.md`** (~27 KB, ~5,000 tokens) — generated via `scripts/build-ai-index.mjs`.
2. **`graphify-out/`** (45 MB JSON) — generated previously via an external Python tool (`graphify.exe`).

### Critical Audit Findings:

1. **Existing `build-ai-index.mjs` relies on naive RegExp, not AST:** It extracts exported symbol names using basic regex (`export (const|function|class|...)`). It cannot extract function signatures, argument types, return types, overloads, arrow functions assigned to objects, interface properties, or method signatures.
2. **No Caller/Callee or Call Graph:** The existing index only tracks whether file A imports an export name from file B, but has zero knowledge of which function invokes which other function.
3. **Tests and Contracts are Completely Blind:** The existing index explicitly excludes `__tests__` directories (836 test files), test utilities, and SQL migrations (355 files). An agent querying the index cannot discover what tests protect a symbol or what Zod schemas validate it.
4. **False Positive Domain Categorization:** Naive substring matching maps unrelated files to wrong domains (e.g. `apps/admin/app/robots.ts` is classified as `Migration` because the word "migrate" appears as a substring).
5. **Graphify Python Dependency is Dead:** The external binary referenced in `AGENTS.md` (`C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe`) does not exist on this machine (Python 3.13 was replaced with Python 3.12, and graphify is absent). The 45 MB `graphify-out/graph.json` file is a frozen snapshot from Oct 26th.
6. **No Incremental Indexing:** Every run of `build-ai-index.mjs` re-reads all 1,877 files, taking ~12.3 seconds with no hash-based cache.
7. **No Query Engine or MCP Interface:** There is currently no CLI (`pnpm code-intel ...`) or MCP tool to search symbols, inspect signatures, or trace callers on demand.

---

## 2. Monorepo Topology & Language Breakdown

### 2.1 Workspace Structure (22 packages)

```text
Root: hisabche (pnpm 11.9.0 + Turbo)
├── apps/
│   ├── admin (@hisabche/admin) — Next.js 16 Web Admin
│   ├── desktop (@hisabche/desktop) — Electron 31 + Vite (Windows)
│   ├── mobile (@hisabche/mobile) — Expo 51 + React Native 0.74 (Android/iOS)
│   └── web (@hisabche/web) — Next.js 16 App Router (Multi-tenant SaaS)
├── backend/
│   └── (@hisabche/backend) — Fastify 4 + Supabase/Postgres + Drizzle
└── packages/
    ├── api (@hisabche/api) — TanStack React Query client hooks
    ├── app-bridge (@hisabche/app-bridge) — Native-to-Web IPC communication
    ├── app-shell (@hisabche/app-shell) — Shared Electron/Capacitor application shell
    ├── auth (@hisabche/auth) — Supabase Auth React bindings
    ├── auth-core (@hisabche/auth-core) — Platform-agnostic auth token/session engine
    ├── config (@hisabche/config) — Shared eslint/prettier/tailwind configs
    ├── db-schema (@hisabche/db-schema) — Drizzle PostgreSQL table definitions
    ├── design-tokens (@hisabche/design-tokens) — Colors, typography, spacing tokens
    ├── formatting (@hisabche/formatting) — Persian/Dari currency, date, numbers
    ├── i18n (@hisabche/i18n) — Next-intl translation catalogs (fa, af, en)
    ├── local-engine (@hisabche/local-engine) — Embedded SQLite offline accounting engine
    ├── mobile-ui (@hisabche/mobile-ui) — React Native mobile components
    ├── store (@hisabche/store) — Zustand global stores
    ├── sync (@hisabche/sync) — Outbox delta sync replication engine
    ├── ui (@hisabche/ui) — Shared Radix + Tailwind component library
    ├── ui-contract (@hisabche/ui-contract) — UI interfaces & view models
    └── validation (@hisabche/validation) — Shared Zod schemas for all business entities
```

### 2.2 File & Language Inventory (Measured)

| Language / File Type |   Count | Role                                                              |
| -------------------- | ------: | ----------------------------------------------------------------- |
| `.ts`                |   2,411 | Backend services, domain logic, validation schemas, stores, types |
| `.tsx`               |   1,203 | Shared UI, Next.js web pages, desktop screens, mobile views       |
| `.json`              |   1,901 | i18n catalogs (fa/af/en), package configs, manifests              |
| `.md`                |   1,276 | Agent guidelines, architecture specs, QA audit reports            |
| `.sql`               |     355 | Supabase migrations, verification scripts (`VERIFY-*.sql`)        |
| `.mjs`               |     173 | Tooling, build scripts, test runners, index generators            |
| `.js` / `.cjs`       |     143 | Config files, legacy scripts, QA drivers                          |
| `.py`                |      20 | Historical migration utilities                                    |
| **Total Test Files** | **836** | `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.pg.test.ts`            |

---

## 3. Existing Code Intelligence Inventory

| Tool                    | Implementation                           | Output                                                                          | Capabilities                                                     | Critical Limitations                                                                         |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **AI Indexer**          | `scripts/build-ai-index.mjs` (794 lines) | `.ai/codebase/graph.json` (5.88 MB)<br>`.ai/codebase/CODEBASE_MAP.md` (26.8 KB) | Regex exports, file size, line count, platform tags, domain tags | No signatures, no types, no callers/callees, skips all tests, no CLI query                   |
| **Graphify**            | External Python (`graphify.exe`)         | `graphify-out/graph.json` (45.2 MB)<br>`graphify-out/GRAPH_REPORT.md` (363 KB)  | AST nodes (32k), links (86k), community clusters                 | Python 3.13 executable missing, static/frozen on Oct 26, 45MB file size exceeds token limits |
| **MCP Gateway**         | `backend/src/routes/mcp.routes.ts`       | HTTP `/mcp` endpoint                                                            | Business tools (invoices, payments, customers)                   | Application data only; zero code-intelligence tools                                          |
| **Husky & Lint-Staged** | `.husky/pre-commit`, `.lintstagedrc.js`  | Git pre-commit hooks                                                            | Batched ESLint + Prettier on staged files (<6,000 chars per cmd) | Formatting only                                                                              |
| **TypeScript Compiler** | `typescript@5.9.3` (installed in root)   | Type-checker / Compiler                                                         | Complete AST, TypeChecker, Symbol flags, Type signatures         | Currently NOT utilized by the indexing pipeline                                              |

---

## 4. Current Performance & Measured Baseline

Baseline measurements taken on the checked-out repository:

| Metric                                         | Measured Baseline                               |
| ---------------------------------------------- | ----------------------------------------------- |
| **Full Index Run Time (`build-ai-index.mjs`)** | **12.34 seconds** (`12,343 ms`)                 |
| **Incremental Run Time**                       | **N/A** (not supported; full re-scan every run) |
| **No-Change Run Time**                         | **12.34 seconds** (no caching)                  |
| **Scanned Files**                              | **1,877 files**                                 |
| **Extracted Symbols**                          | **11,783 symbols** (names only)                 |
| **Covered Packages**                           | **21 packages**                                 |
| **Indexed Test Files**                         | **0** (100% skipped)                            |
| **Indexed SQL Migrations**                     | **0** (100% skipped)                            |
| **Output Size (`graph.json`)**                 | **5,889,208 bytes** (~5.88 MB)                  |
| **Output Size (`CODEBASE_MAP.md`)**            | **26,839 bytes** (~26.8 KB, ~5,300 tokens)      |
| **Query Latency**                              | **N/A** (no query interface exists)             |

---

## 5. Architectural Gap Analysis

### Gap 1: Naive Regex vs. TypeScript Compiler API

```typescript
// Real Hisabche Code (packages/local-engine/src/invoices/create-invoice.ts):
export const createInvoice = async (
  db: Database,
  input: CreateInvoiceInput
): Promise<InvoiceResult> => { ... }
```

- **Existing Indexer sees:** `{ name: "createInvoice", kind: "declaration", line: 42 }`
- **Agent needs:**
  - Exact signature: `(db: Database, input: CreateInvoiceInput) => Promise<InvoiceResult>`
  - Node span: `startLine: 42, endLine: 118`
  - Export kind: `const` (arrow function)
  - Parameter types & return type

### Gap 2: Missing Call Graph (Callers & Callees)

An agent modifying `packages/validation/src/schemas/invoice.schema.ts` currently cannot ask:

- _Who imports and invokes this schema?_
- _Which Fastify routes validate against it?_
- _Which UI forms pass data to it?_

### Gap 3: Complete Blindness to Tests

There are **836 test files** in Hisabche (`vitest`, `jest`, `pg.test.ts`). Because `__tests__` is excluded in `IGNORE_DIRS`, no agent can query:

- _Which tests exercise `AccountingService.getProfitReport`?_
- _Is there an existing test for payment allocations?_

### Gap 4: Frozen / Dead Graphify Binary

`AGENTS.md` directs agents to run:
`C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe explain "<Symbol>"`
This command fails immediately on Windows because Python 3.13 is no longer installed on the machine.

---

## 6. Proposed Minimal Extension Strategy (No Competing Architecture)

In accordance with Section 1.2 ("Extend, do not duplicate"):

1. **Keep Single Source of Truth:**
   - Extend `scripts/build-ai-index.mjs` (or import modular engines into it) rather than creating a second competing indexing system.
   - Output to `.ai/codebase/graph.json` and `.ai/codebase/CODEBASE_MAP.md`.

2. **AST-Backed Symbol Extraction using TypeScript Compiler API:**
   - Utilize the already-installed `typescript@5.9.3` in the root workspace.
   - Parse files with `ts.createSourceFile` (fast AST parse without requiring full program type-check) to extract exact function signatures, params, return types, classes, interfaces, types, enums, React hooks, and components.

3. **Incorporate Test & Contract Mapping:**
   - Add a lightweight secondary scan for `*.test.ts`, `*.test.tsx`, `*.spec.ts`.
   - Index test suite names (`describe`) and test cases (`it`/`test`), mapping their imports directly to the symbols they exercise.
   - Index Zod schemas (`packages/validation`) as first-class contracts.

4. **Incremental Hash-Based Caching:**
   - Maintain `.ai/codebase/.cache.json` recording `contentHash` per file.
   - When a file has not changed, reuse cached symbol and dependency nodes.
   - Target: Reduce no-change run time from **12.3s** to **<0.8s**.

5. **Unified Query Core (`packages/code-intel` or `scripts/code-intel.mjs`):**
   - Single engine implementing:
     - `search_symbols(query, filter)`
     - `get_symbol(id)`
     - `get_source(id)`
     - `get_callers(id)`
     - `get_callees(id)`
     - `find_tests(id)`
     - `impact_analysis(id)`
     - `trace_flow(domain)`
     - `verify_index()`
   - Expose via:
     - **CLI:** `node scripts/code-intel.mjs <command>` (or `pnpm code-intel ...`)
     - **MCP Server:** `node scripts/code-intel-mcp.mjs` (stdio JSON-RPC for Claude Code, Cursor, OpenCode).

6. **Preserve `CODEBASE_MAP.md` as Compact Architectural Anchor:**
   - Ensure `CODEBASE_MAP.md` remains strictly within **4,000–6,000 tokens** (<300 lines).
   - High-level topology, platform hazard map, domain matrix, high-confidence entry points, and discovery instructions.

---

## 7. Phase 0 Gate Acceptance Checklist

- [x] Every important existing code-intelligence tool inspected (`build-ai-index.mjs`, `graphify-out`, `backend/mcp`, `husky`).
- [x] Existing index generator executed and measured (**12.34s, 1,877 files, 11,783 symbols**).
- [x] Initial Git status confirmed clean (`b9f90056afad64cb1af2f634482ecb0110bf7030`).
- [x] Language, test, and package topology measured across the real monorepo (**3,930 TS/JS, 355 SQL, 836 tests**).
- [x] Real status of external tools determined (Python 3.13 Graphify binary missing; Node/TS environment fully functional).
- [x] Zero duplicate architecture introduced; extension path established.
