# HISABCHE CODE INTELLIGENCE — PHASE 2 REPORT

## AST-Based Symbol References, Dependency Graph & Relationship Index

**Date:** October 30, 2026  
**Status:** `VERIFIED_COMPLETE`  
**Git Baseline Commit:** `b9f90056afad64cb1af2f634482ecb0110bf7030`  
**Implementation Scope:** Phase 2 ONLY (Module & symbol relationships, call graph, dependency graph, cycle detection, and test linkage)

---

## 1. EXECUTIVE SUMMARY

Phase 2 successfully extended Hisabche's AST-backed code intelligence layer with a verified relationship and dependency index.

The indexer now moves beyond isolated symbol declarations to answer cross-file semantic questions with evidence-backed certainty:

- Where is a symbol defined, called, or instantiated?
- Which modules does a file import, re-export, or depend on?
- What is the complete dependency tree between workspace packages and files?
- Are there circular dependencies, where do they exist, and which edges form them?
- Which test files exercise specific production symbols?

### Measured Key Results

- **Total Relationships Extracted:** **63,830 typed relationships** across 1,877 source files and 836 test files.
- **Categorical Breakdown:**
  - `CALLS`: 33,915
  - `USES_TYPE`: 14,576
  - `IMPORTS`: 7,748
  - `INSTANTIATES`: 4,148
  - `TESTS`: 2,353
  - `RE_EXPORTS`: 932
  - `DYNAMIC_IMPORTS`: 79
  - `EXTENDS`: 76
  - `IMPLEMENTS`: 3
- **Resolution Accuracy (Zero Hallucination Policy):**
  - **Resolved (`AST_VERIFIED`):** 35,439 relationships (55.5%)
  - **External Dependencies:** 12,539 relationships (19.6%)
  - **Unresolved / Inferred (`STATIC_INFERENCE`):** 15,852 relationships (24.8% — unimported calls and global dynamics strictly marked without false guessing)
  - **Ambiguous:** 0
- **Deterministic Rebuild:** Verified bit-for-bit identical output (`Hash: 32500f54b70712925b6a34238b0e6a166e8e62c220539708a03b3c7f85678b1d`).
- **Test Suite Verification:** **68 / 68 tests passing** (20 Phase 1 AST fixtures, 10 Phase 1 golden symbols, 11 module resolver tests, 11 AST relationship tests, 4 dependency graph/cycle tests, 12 Phase 2 golden relationship tests).

---

## 2. BASELINE VERIFICATION & COVERAGE INVENTORY

### A. Phase 1 Verification

- Git HEAD: `b9f90056afad64cb1af2f634482ecb0110bf7030`
- Phase 1 Test Suite: 30 / 30 tests verified passing in 549ms.
- Phase 1 Symbols: 17,875 symbols in `graph.json` (12,250 resolved, 5,608 partially resolved, 17 unresolved).

### B. Repository File Inventory (Excluding `node_modules` and `.p`)

- **TypeScript / TSX production source files:** 1,877 files indexed.
- **Test files:** 836 test files discovered across workspace packages.
- **Packages indexed:** 21 packages (apps/web, apps/desktop, apps/mobile, apps/admin, backend, and 16 packages).

---

## 3. IMPLEMENTATION ARCHITECTURE

Phase 2 was implemented strictly as modular, zero-dependency extensions using Node.js built-ins and the existing `typescript@5.9.3` runtime:

1. **`scripts/lib/module-resolver.mjs` (Created):**
   - High-performance module resolution engine.
   - Parses root and per-package `tsconfig.json` paths (`@hisabche/*`, `@/*`).
   - Resolves relative paths (`./`, `../`), TypeScript extensions (`.ts`, `.tsx`, `.d.ts`, `.js`), directory index files (`/index.ts`), workspace packages, and external npm packages.
   - Distinguishes internal workspace modules from third-party/external dependencies.

2. **`scripts/lib/ast-relationship-extractor.mjs` (Created):**
   - Extracts module-level relationships (`IMPORTS`, `RE_EXPORTS`, `DYNAMIC_IMPORTS`).
   - Extracts symbol-level references (`CALLS`, `EXTENDS`, `IMPLEMENTS`, `INSTANTIATES`, `USES_TYPE`).
   - Resolves method invocations on `this.method()`, namespace invocations `ns.method()`, and constructor `new Class()`.
   - Generates deterministic stable IDs: `rel:<TYPE>:<sourceId>-><targetId>:<line>:<col>`.
   - Enforces strict separation between `status` (`RESOLVED`, `UNRESOLVED`, `EXTERNAL`, `DYNAMIC_UNRESOLVED`) and `evidence` (`AST_VERIFIED`, `STATIC_INFERENCE`).
   - Indexes `TESTS` relationships connecting test files to the exact production symbols they call and import.

3. **`scripts/lib/dependency-graph.mjs` (Created):**
   - Builds directed file-to-file and package-to-package dependency graphs from resolved edges.
   - Implements Tarjan's Strongly Connected Components algorithm for cycle detection.
   - Detects direct cycles (length 2) and indirect cycles (length > 2) with participating nodes and verification flags.

4. **`scripts/build-ai-index.mjs` (Updated):**
   - Integrates module resolution, relationship extraction, dependency graphing, and cycle detection.
   - Generates `graph.relationships`, `graph.dependencies`, and `graph.metadata.relationshipStats`.
   - Updates `CODEBASE_MAP.md` while keeping size at 27.4 KB (~5,490 tokens, safely below the 6,000 token limit).

---

## 4. RELATIONSHIP SCHEMA SPECIFICATION (v2)

Each relationship record in `graph.relationships` adheres to:

```typescript
interface RelationshipRecordV2 {
  id: string // Deterministic hash, e.g. "rel:CALLS:07f012268f33bcc8"
  type:
    | 'IMPORTS'
    | 'RE_EXPORTS'
    | 'DYNAMIC_IMPORTS'
    | 'DEPENDS_ON'
    | 'CALLS'
    | 'REFERENCES'
    | 'EXTENDS'
    | 'IMPLEMENTS'
    | 'INSTANTIATES'
    | 'USES_TYPE'
    | 'RETURNS_TYPE'
    | 'TESTS'
  sourceId: string // Symbol ID (e.g. "@pkg/file#symbol") or File Path
  targetId: string // Target Symbol ID, Target File Path, or External Package
  file: string // Normalized file path of origin
  startLine: number // 1-based start line
  startColumn: number // 1-based start column
  endLine: number // 1-based end line
  endColumn: number // 1-based end column
  rawIdentifier: string // Exact expression / identifier text
  status:
    'RESOLVED' | 'UNRESOLVED' | 'EXTERNAL' | 'DYNAMIC_UNRESOLVED' | 'AMBIGUOUS' | 'UNSUPPORTED'
  evidence: 'AST_VERIFIED' | 'TYPE_CHECKER_VERIFIED' | 'STATIC_INFERENCE' | 'NAME_MATCH_ONLY'
  sourceHash: string // SHA-256 hash of origin expression
}
```

---

## 5. DEPENDENCY GRAPH & CYCLE ANALYSIS

- **Total File Graph Nodes:** 1,495 files with resolved dependency edges
- **Total File Graph Edges:** 6,763 directed import edges
- **Total Package Graph Nodes:** 14 workspace packages
- **Total Package Graph Edges:** 1,397 cross-package edges

### Cycles Discovered:

- **File-level Cycles:** 3 cycles detected.
- **Package-level Cycles:** 1 direct cycle detected:
  - `@hisabche/app-shell` <—> `@hisabche/ui` (length: 2, statically verified direct cycle).
  - _Context:_ Shared shell adapters consuming UI widgets while UI components consume shell router shims.

---

## 6. GOLDEN TESTS SUMMARY (10 REAL HISABCHE DOMAINS)

All 12 golden tests in `scripts/__tests__/golden-relationships.test.mjs` pass cleanly:

1. **Invoices:** `packages/local-engine/src/routes/invoices.ts` -> Cross-file import and `USES_TYPE` to `packages/local-engine/src/db.ts#LocalDb` (RESOLVED, AST_VERIFIED).
2. **Payments:** `backend/src/services/payments/payments.repository.ts` -> Cross-file imports to `backend/src/db.ts` and `backend/src/utils/client-request.ts`.
3. **Inventory:** `packages/validation/src/schemas/product.schema.ts` -> Cross-file import to `common.schema.ts` and external import to `zod`.
4. **Accounting:** `backend/src/services/accounting/profit-report.domain.ts` -> Re-export resolution to `@hisabche/validation` (`packages/validation/src/index.ts`).
5. **Sync:** `packages/app-bridge/src/push-order.ts` -> Global instantiation `new Map()` (EXTERNAL, global:Map).
6. **Backend Routes:** `backend/src/routes/accounting.routes.ts` -> External import `fastify` and cross-file import to `month-end.service.ts`.
7. **API Client:** `packages/api/src/hooks/useActivities.ts` -> External import `@tanstack/react-query` and relative import to `client.ts`.
8. **Shared UI:** `packages/ui/src/components/ui/dashboard-header.tsx` -> External import `react` and cross-file import to `@hisabche/formatting`.
9. **Validation:** `packages/validation/src/schemas/workspace.schema.ts` -> External import `zod` and relative import to `common.schema.ts`.
10. **Local Engine:** `packages/local-engine/src/db.ts` -> Pure interface declarations verified without unresolvable fake calls.
11. **Same-Name Differentiation:** Symbols with identical names in different files produce distinct, non-conflated target IDs.
12. **Unresolved Veracity:** Dynamic unresolvable imports and unimported function calls remain marked `UNRESOLVED` / `STATIC_INFERENCE` without false positive claims.

---

## 7. COMPLETE TEST SUITE VERIFICATION

All 6 test suites and 68 tests executed via `node --test scripts/__tests__/*.test.mjs`:

- `ast-symbol-extractor.test.mjs`: 20 / 20 PASS
- `golden-symbols.test.mjs`: 10 / 10 PASS
- `module-resolver.test.mjs`: 11 / 11 PASS
- `ast-relationships.test.mjs`: 11 / 11 PASS
- `dependency-graph.test.mjs`: 4 / 4 PASS
- `golden-relationships.test.mjs`: 12 / 12 PASS
- **Total: 68 / 68 PASS (0 failures, duration < 1s)**

---

## 8. REPOSITORY COMPATIBILITY & SAFETY CONFIRMATION

- **Existing Graph Compatibility:** All Phase 1 fields (`metadata`, `packages`, `packageDeps`, `files`, `symbols`, `routes`) remain 100% intact.
- **Legacy Lookup Keys:** Primary lookup keys `${file}::${name}` and canonical `id` are fully preserved.
- **Human Map Size:** `CODEBASE_MAP.md` is 27,456 bytes (~5,490 tokens), strictly below 6,000 tokens.
- **Zero Business Code Changes:** Zero product/business lines modified.
- **Zero Database Changes:** Zero database migrations or schemas touched.
- **Zero Git Mutations:** No commit, push, or reset performed (Rule 0).
