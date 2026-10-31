# HISABCHE CODE INTELLIGENCE — PHASE 3 TECHNICAL REPORT

## Unified Query Engine, Evidence-Backed Code Navigation & CLI Interface

**Document Version:** 1.0.0  
**Phase:** Phase 3 of Universal Code Intelligence System  
**Prerequisites:** Phase 1 (AST Symbol Extraction) & Phase 2 (Relationship Graph)  
**Status:** `IMPLEMENTED` | `UNIT TESTED (110/110 passing)` | `BENCHMARKED`  
**Execution Date:** October 30, 2026

---

## 1. Executive Summary

Phase 3 delivers the unified querying and discovery layer for the Hisabche Code Intelligence System. Built directly on top of the compiler-backed AST symbol cards (Phase 1) and verified relationship graph (Phase 2), Phase 3 provides both a programmatic query engine (`scripts/lib/code-intel-query.mjs`) and a zero-dependency CLI (`scripts/code-intel.mjs` / `pnpm code-intel`).

Prior to Phase 3, an AI agent or developer navigating the monorepo faced a stark dilemma:

1. Grep or guess across 1,877 source files, frequently hallucinating missing methods or re-implementing existing logic.
2. Ingest massive repository files into context windows, blowing token limits and diluting reasoning.

Phase 3 eliminates this dilemma by providing sub-millisecond, evidence-grounded queries that return compact, structured JSON cards with exact file locations, full TypeScript signatures, verified callers/callees, dependency impacts, and source excerpts.

---

## 2. Core Architecture & Design Decisions

### 2.1 Reusable Engine Core (`CodeIntelQueryEngine`)

The query engine is isolated in `scripts/lib/code-intel-query.mjs` with zero runtime dependencies beyond Node.js built-ins.

```text
                  .ai/codebase/graph.json (56 MB Canonical Graph)
                                    │
                                    ▼
                      CodeIntelQueryEngine.load()
                   [In-Memory Secondary Lookup Indices]
                     ├── symbolsById (17,875 entries)
                     ├── symbolsByName (multi-declaration map)
                     ├── symbolsByFile (per-module symbols)
                     ├── incomingRels (targetId -> callers/importers)
                     ├── outgoingRels (sourceId -> callees/imports)
                     ├── fileIncomingRels (file-level dependents)
                     └── fileOutgoingRels (file-level imports)
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
Programmatic Query API                                    CLI Interface
(lib/code-intel-query.mjs)                            (scripts/code-intel.mjs)
- findSymbols()                                       - pnpm code-intel symbol find
- getSymbol()                                         - pnpm code-intel symbol show
- getCallers() / getCallees()                         - pnpm code-intel callers/callees
- getImports() / getRelatedTests()                    - pnpm code-intel imports/tests
- getImpactSummary()                                  - pnpm code-intel impact
- getSourceExcerpt()                                  - pnpm code-intel source
- getIndexStatus()                                    - pnpm code-intel status
```

### 2.2 Key Architectural Principles

1. **Single Source of Truth:** Operates directly over `.ai/codebase/graph.json`. No secondary database or duplicate persistent caches.
2. **Lazy Secondary In-Memory Indexing:** Populates fast hash maps upon `.load()` in < 400ms, enabling O(1) exact lookups and O(k) graph traversals.
3. **Disambiguation of Same-Name Declarations:** Rather than arbitrarily returning the first match when multiple declarations share a name (e.g., `createInvoice` in `@hisabche/backend` vs `@hisabche/local-engine`), the engine detects ambiguity, tags it with `AMBIGUOUS`, and provides the exact candidate IDs.
4. **Freshness & Staleness Verification:** Every source excerpt and status check hashes current disk files and verifies git commit state to alert agents when the index requires rebuilding.
5. **Security & Sandbox Isolation:** Hardened against path traversal (`..` escaping root), `.env*` reads, and `node_modules` inspection.

---

## 3. Query Engine API Reference (`scripts/lib/code-intel-query.mjs`)

| Method                           | Parameters                                                                    | Return Shape                                                                                                      | Primary Use Case                                     |
| -------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `findSymbols(query, filters)`    | `query: string`, `filters: { exact, kind, domain, package, exported, limit }` | `{ query, totalFound, results: SymbolCard[] }`                                                                    | Broad or exact symbol discovery across repo          |
| `getSymbol(idOrName)`            | `idOrName: string`                                                            | `{ found, ambiguous, symbol, allMatches, candidates, warning, error }`                                            | Exact symbol lookup with disambiguation              |
| `getCallers(idOrName, opts)`     | `idOrName: string`, `opts: { verifiedOnly, limit }`                           | `{ target, targetName, totalFound, callers: CallerRecord[] }`                                                     | Discover all verified callers of a function/method   |
| `getCallees(idOrName, opts)`     | `idOrName: string`, `opts: { verifiedOnly, limit }`                           | `{ target, targetName, totalFound, callees: CalleeRecord[] }`                                                     | Discover all functions/methods called by a symbol    |
| `getImports(fileOrSymbol)`       | `fileOrSymbol: string`                                                        | `{ file, totalImports, totalReExports, imports, reExports }`                                                      | Inspect inbound module dependencies                  |
| `getRelatedTests(idOrName)`      | `idOrName: string`                                                            | `{ targetSymbol, totalTests, tests: TestRecord[] }`                                                               | Find tests covering a specific symbol                |
| `getFile(filePath)`              | `filePath: string`                                                            | `{ found, file, platform, domain, symbols, imports, reExports, directDependents }`                                | File metadata, exports, and dependents               |
| `getImpactSummary(target, opts)` | `target: string`, `opts: { depth, limit }`                                    | `{ target, targetFile, depth, directCallers, directCallees, transitiveDependents, relatedTests, relevantCycles }` | Blast radius analysis before modifying code          |
| `getSourceExcerpt(target, opts)` | `target: string`, `opts: { startLine, endLine, contextLines }`                | `{ success, file, startLine, endLine, isStale, excerpt, linesWithNumbers, error }`                                | Bounded source retrieval without reading whole files |
| `getIndexStatus()`               | None                                                                          | `{ status, schemaVersion, indexedGitHash, currentGitHead, gitMatch, totalFiles, totalSymbols, ... }`              | Index health and staleness check                     |

---

## 4. CLI Interface & Commands (`scripts/code-intel.mjs`)

Registered in root `package.json` under `"code-intel"`. Supports both human-readable terminal output and `--json` for agent communication.

### 4.1 CLI Command Summary

```bash
# Index Status
pnpm code-intel status [--json]

# Symbol Discovery
pnpm code-intel symbol find <name> [--exact] [--kind <k>] [--pkg <p>] [--domain <d>] [--limit <n>] [--json]
pnpm code-intel symbol show <symbolId|name> [--json]

# Call Graph
pnpm code-intel callers <symbolId|name> [--verified-only] [--limit <n>] [--json]
pnpm code-intel callees <symbolId|name> [--verified-only] [--limit <n>] [--json]

# Modules & Tests
pnpm code-intel imports <filePath|symbolId> [--json]
pnpm code-intel tests <symbolId|name> [--json]

# Impact & File Overview
pnpm code-intel impact <symbolId|file> [--depth <n>] [--limit <n>] [--json]
pnpm code-intel file <filePath> [--json]

# Source Excerpt
pnpm code-intel source <symbolId|filePath> [--context <n>] [--json]
```

### 4.2 CLI Exit Codes

- `0`: Success.
- `1`: User/Query error (missing arguments, invalid command, target not found).
- `2`: System error (corrupt or missing `.ai/codebase/graph.json`).

---

## 5. JSON Response Contract for Coding Agents

Every CLI invocation with `--json` produces a standardized, deterministic JSON envelope:

```json
{
  "query": {
    "operation": "symbol show",
    "target": "useActivities",
    "flags": {
      "json": true
    }
  },
  "index": {
    "status": "FRESH",
    "schemaVersion": 2
  },
  "resultCount": 1,
  "truncated": false,
  "results": [
    {
      "schemaVersion": 1,
      "id": "@hisabche/api/packages/api/src/hooks/useActivities.ts#useActivities",
      "name": "useActivities",
      "kind": "function",
      "signature": "export function useActivities(options?: UseActivitiesOptions)",
      "file": "packages/api/src/hooks/useActivities.ts",
      "line": 45,
      "startLine": 45,
      "endLine": 82,
      "package": "@hisabche/api",
      "exported": true,
      "domain": "Sync",
      "platform": "SHARED"
    }
  ],
  "warnings": [],
  "errors": []
}
```

---

## 6. Security, Freshness & Anti-Hallucination Guardrails

1. **Path Traversal Shield:**  
   `getSourceExcerpt` validates that all paths resolve strictly within `process.cwd()`. Any path with `..` escaping workspace boundaries returns `{ success: false, error: 'Security rejection: Path traversal outside repository root is forbidden.' }`.
2. **Secret Protection (Rule 3 Enforcement):**  
   Any attempt to query or retrieve `.env*` or files under `node_modules` is rejected immediately.
3. **Staleness Alarm:**  
   When retrieving source excerpts, the engine hashes the disk file and compares it to `sym.fileHash`. If modified, it flags `isStale: true` and includes a warning urging an index rebuild.
4. **Anti-Hallucination Disambiguation:**  
   When multiple declarations share a name, the engine refuses to guess. It sets `ambiguous: true`, lists candidate symbol IDs, and prevents coding agents from assuming an arbitrary overload or file target.

---

## 7. Golden Query Validation across 10 Real Domains

All 10 real Hisabche domains were verified with exhaustive end-to-end golden tests in `scripts/__tests__/golden-queries.test.mjs`:

| #   | Domain                 | Target Symbol / File  | Verified Capabilities                                                                                  | Test Result |
| --- | ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| 1   | **Invoices**           | `createInvoiceSchema` | Resolved Zod schema, signature, verified start/end lines, extracted source excerpt                     | **PASS**    |
| 2   | **Payments**           | `PaymentsRepository`  | Resolved backend class, package `@hisabche/backend`, verified file relationships                       | **PASS**    |
| 3   | **Inventory**          | `productSchema`       | Exact lookup with package filtering, confirmed exported Zod definition                                 | **PASS**    |
| 4   | **Accounting**         | `buildProfitReport`   | Disambiguated across 3 packages (`@hisabche/backend`, `@hisabche/validation`), resolved backend domain | **PASS**    |
| 5   | **Sync & App-Bridge**  | `createPushGate`      | Function resolution, verified 4 outbound AST callees                                                   | **PASS**    |
| 6   | **Backend Routes**     | `accountingRoutes`    | Fastify route plugin discovery, verified module imports                                                | **PASS**    |
| 7   | **API Client & Hooks** | `useActivities`       | Hook discovery, line-numbered source extraction without reading whole hook file                        | **PASS**    |
| 8   | **Shared UI**          | `DashboardHeader`     | Disambiguated admin vs shared UI, classified as `react_component`                                      | **PASS**    |
| 9   | **Validation**         | `workspaceSchema`     | Schema contracts, line-range validation, source excerpt                                                | **PASS**    |
| 10  | **Local Engine**       | `LocalDb`             | SQLite interface discovery, 1-depth impact traversal, cycle detection check                            | **PASS**    |

---

## 8. Performance & Context Efficiency Benchmarks

Measured on the Hisabche repository (1,877 files, 17,875 symbols, 63,830 relationships):

| Operation                                         | Measured Latency | Target Latency | Status                     |
| ------------------------------------------------- | ---------------- | -------------- | -------------------------- |
| **Secondary Index Initialization (`load()`)**     | 398.54 ms        | < 500 ms       | **EXCEEDED**               |
| **Exact Symbol Lookup (`getSymbol`)**             | 0.167 ms         | < 5 ms         | **EXCEEDED (30x faster)**  |
| **Fuzzy Symbol Search (`findSymbols`)**           | 9.853 ms         | < 50 ms        | **EXCEEDED (5x faster)**   |
| **Caller Query (`getCallers`)**                   | 0.210 ms         | < 10 ms        | **EXCEEDED (47x faster)**  |
| **Callee Query (`getCallees`)**                   | 0.094 ms         | < 10 ms        | **EXCEEDED (100x faster)** |
| **Impact Subgraph Traversal (depth=2)**           | 0.762 ms         | < 50 ms        | **EXCEEDED (65x faster)**  |
| **Source Excerpt Extraction & Hash Verification** | 1.862 ms         | < 10 ms        | **EXCEEDED (5x faster)**   |

### Context Window Efficiency Comparison

| Approach                            | Tokens Consumed       | Cost / Latency Risk                     | Grounding Level       |
| ----------------------------------- | --------------------- | --------------------------------------- | --------------------- |
| Ingesting full files for discovery  | ~45,000 tokens        | Context blowout, hallucinated calls     | Medium                |
| Guessing symbols via grep           | ~8,000 tokens         | False positives, duplicate declarations | Low                   |
| **Phase 3 Code Intelligence Query** | **~250 - 650 tokens** | **Near-zero overhead (< 2ms)**          | **100% AST Evidence** |

---

## 9. Test Suite Verification Summary

```text
Test Suites: 9 passed, 9 total
Tests:       110 passed, 110 total
Snapshots:   0 total
Time:        12.615s

Suites Breakdown:
1. AST Symbol Extractor Unit Tests:        20 / 20 PASS
2. AST Symbol Golden Tests (10 Domains):   10 / 10 PASS
3. Module Resolver Unit Tests:             11 / 11 PASS
4. AST Relationship Extractor Unit Tests:  11 / 11 PASS
5. Dependency Graph & Cycle Tests:          6 /  6 PASS
6. AST Relationship Golden Tests:          10 / 10 PASS
7. Code Intelligence Query Engine Tests:   20 / 20 PASS
8. Code Intelligence CLI Tests:            12 / 12 PASS
9. 10-Domain Golden Query Tests:           10 / 10 PASS
------------------------------------------------------
Total Verified Tests:                     110 / 110 PASS (100%)
```

---

## 10. Conclusion & Next Step Authorization

Phase 3 is complete and verified. It provides the programmatic and command-line querying foundation necessary for AI agents to query the codebase accurately, rapidly, and safely.

Per executive governance rules, **Phase 4 (Incremental Indexing & File Watchers)** and **Harness Integrations (MCP Servers)** remain strictly deferred until owner authorization.
