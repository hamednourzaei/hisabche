# HISABCHE CODE INTELLIGENCE — MANDATORY AGENT WORKFLOW GUIDE

## Standard Operating Procedures for All AI Coding Agents (Claude Code, Cursor, OpenCode, Codex, Antigravity)

**Document Version:** 1.0.0  
**Status:** CANONICAL REFERENCE  
**Associated Policies:** `AGENTS.md` (§0.6), `CLAUDE.md`

---

## 1. Core Principle: Zero Hallucination, Zero Duplication

Hisabche is a mission-critical multi-platform ERP (Web, Windows Desktop, Android, Backend) with 1,877+ source files. No AI agent can hold the entire repository in its context window.

To prevent:

- **Hallucinating** methods or database columns that do not exist.
- **Reimplementing** services or utilities that already exist in shared packages.
- **Breaking unseen callers** across other packages.
- **Blowing context windows** with massive file reads.

**Every coding agent MUST follow the Mandatory Preflight and Postflight protocols defined herein.**

---

## 2. Available Code Intelligence Interfaces

The Code Intelligence System provides two identical, AST-backed interfaces sharing the same query core:

### 2.1 Local MCP Server (`stdio` JSON-RPC 2.0)

- **Script:** `node scripts/code-intel-mcp.mjs` (or `pnpm code-intel:mcp`)
- **Transport:** Standard input / standard output line-delimited JSON-RPC 2.0.
- **Exposed Tools:**
  1. `code_intel_status`: Returns index health, schema version, git commit match, and entity counts.
  2. `code_intel_find_symbols`: Finds symbols by exact/fuzzy name with domain, package, kind, and export filters.
  3. `code_intel_get_symbol`: Retrieves exact symbol card with signature, file, line numbers, docstring, and hashes. Detects same-name declarations and returns `ambiguous: true` with candidate IDs.
  4. `code_intel_get_relationships`: Retrieves callers, callees, imports, and related tests using verified AST edges.
  5. `code_intel_impact`: Performs bounded blast-radius analysis (depth 1–3) and detects circular dependency cycles.
  6. `code_intel_get_source`: Retrieves line-numbered source excerpts with file-level SHA-256 freshness verification. Rejects path traversal and `.env*` accesses.

### 2.2 CLI Interface (Terminal & Subprocess)

- **Command:** `pnpm code-intel <command>` (or `node scripts/code-intel.mjs <command>`)
- **Flags:** `--json` for structured output, `--exact` for exact name matches.
- **Commands:**
  ```bash
  # Check index health & freshness
  pnpm code-intel status [--json]

  # Search symbols
  pnpm code-intel symbol find <name> [--exact] [--kind <k>] [--pkg <p>] [--domain <d>] [--limit <n>] [--json]
  pnpm code-intel symbol show <symbolId|name> [--json]

  # Call graph & relationships
  pnpm code-intel callers <symbolId|name> [--verified-only] [--limit <n>] [--json]
  pnpm code-intel callees <symbolId|name> [--verified-only] [--limit <n>] [--json]
  pnpm code-intel imports <filePath|symbolId> [--json]
  pnpm code-intel tests <symbolId|name> [--json]

  # Blast radius & file inspection
  pnpm code-intel impact <symbolId|file> [--depth <n>] [--limit <n>] [--json]
  pnpm code-intel file <filePath> [--json]

  # Bounded source retrieval
  pnpm code-intel source <symbolId|filePath> [--context <n>] [--json]
  ```

---

## 3. Mandatory Preflight Protocol (Before Any Code Planning or Editing)

Before proposing architecture, opening files, or editing code:

### Step 1: Working Tree & Rule 0 Check

- Run `git status --short`.
- Note current branch and HEAD commit.
- **Preserve user work:** Never reset, checkout `--`, stash, or overwrite existing modifications in the working tree.
- **Rule 0:** Never `git commit`, `git push`, `git reset`, or rebase.

### Step 2: Code Intelligence Availability & Freshness Check

- Run `pnpm code-intel status --json` (or invoke `code_intel_status` via MCP).
- Verify `index.status === 'FRESH'`.
- If `status === 'STALE'` (git HEAD or files differ):
  - Record the staleness warning.
  - If instructed by workflow, rebuild index: `node scripts/build-ai-index.mjs` (< 2s).
  - Never manually edit `graph.json` or generated artifacts.

### Step 3: Grounded Discovery

Before editing or creating any function, component, schema, or route:

1. **Check for existing implementation:**
   `pnpm code-intel symbol find <TargetName>`
   Rule: If a service, hook, utility, or schema already exists, **extend it**. Never create a duplicate (Rule 2).
2. **Inspect exact signatures and contracts:**
   `pnpm code-intel symbol show <ExactSymbolId>`
   Read the real signature, parameters, and return types directly from the AST compiler card.
3. **Inspect callers & callees:**
   `pnpm code-intel callers <ExactSymbolId>`
   Know every call-site that will be affected by your change across Web, Desktop, Mobile, and Backend.
4. **Evaluate cross-module blast radius:**
   `pnpm code-intel impact <ExactSymbolIdOrFile> --depth 2`
   Identify all downstream packages, consumers, and potential circular dependency cycles.
5. **Retrieve precise source excerpt:**
   `pnpm code-intel source <ExactSymbolId> --context 3`
   Inspect the exact lines without reading entire 1,000-line files into context.

### Step 4: Fallback Protocol

If MCP or CLI is unavailable, broken, or returns an error:

1. Document the exact error or limitation.
2. Fall back to scoped repository search (`rg -n "exact_symbol" packages/<domain>`).
3. Never conclude that a capability does not exist simply because a query returned empty.
4. Inspect real source files and verify existence manually before proceeding.

---

## 4. Mandatory Postflight Protocol (After Every Code Change)

Before declaring any task finished:

### Step 1: Change Integrity Check

- Run `git diff --check` to catch trailing whitespaces or merge markers.
- Run `git status --short` and `git diff --stat` to verify that **only** task-related files were changed.
- Verify that no user work was overwritten or reverted.

### Step 2: Test & Quality Gate Verification

From the packages you modified:

```bash
# Typecheck
cd <package-dir> && npx tsc --noEmit

# Focused unit tests
cd <package-dir> && npx vitest run <relevant-test-file>

# Linting
npx eslint <each-modified-file>
```

All checks must produce **0 errors**.

### Step 3: Code Intelligence Freshness Check

- Run `pnpm code-intel status`.
- If modified source files changed the index state, explicitly note: `Index Status: STALE (requires rebuild upon completion)`.
- Note: Do NOT claim incremental indexing exists; it is not yet implemented.

### Step 4: Final Reporting Standards (Rule 9 Parity)

Every completion report must use the standardized vocabulary:

- `VERIFIED_COMPLETE`: Only if real runtime, real Postgres, or live HTTP inject tests passed.
- `IMPLEMENTED_NOT_LIVE_VERIFIED`: Code implemented and typechecked, but no live database/emulator verified.
- `VERIFIED_WITH_LIMITATIONS`: Verified within explicit stated constraints.
- `BLOCKED`: Blocked by external credential or missing prerequisite.

Report separate statuses for:

1. Implementation Status
2. Automated Unit/Regression Tests
3. Runtime / Device Verification
4. Production / DB Verification
5. Harness / MCP Connection Status
6. Code Intelligence Index Freshness

---

## 5. Live Integration Verification Scenario (Phase 4.1 Proof)

The live MCP integration was verified against the real Hisabche invoice domain using `node scripts/code-intel-mcp.mjs`:

| Step | Operation                      | Target                                 | MCP Output Evidence                                                   | Status  |
| ---- | ------------------------------ | -------------------------------------- | --------------------------------------------------------------------- | ------- |
| 1    | `code_intel_status`            | Index                                  | Status: `FRESH`, Files: 1,877, Symbols: 17,875, Rels: 63,830          | ✅ PASS |
| 2    | `code_intel_find_symbols`      | `buildInvoice`                         | 6 symbols matched in `Invoices` domain                                | ✅ PASS |
| 3    | `code_intel_get_symbol`        | `@hisabche/app-shell/...#buildInvoice` | Signature: `(lines, currency, customerId?, type?) => CreateInvoice`   | ✅ PASS |
| 4    | `code_intel_get_relationships` | `direction: callers`                   | 0 verified callers in sales feature (pure builder function)           | ✅ PASS |
| 5    | `code_intel_get_relationships` | `direction: tests`                     | Tested against invoice test suites                                    | ✅ PASS |
| 6    | `code_intel_get_source`        | `buildInvoice`                         | 28 lines retrieved with line numbers, SHA-256 match, `isStale: false` | ✅ PASS |
| 7    | `code_intel_impact`            | `invoice-draft.ts`                     | Bounded depth-2 traversal executed in 0.2ms, 0 circular cycles        | ✅ PASS |

All 6 tools operate deterministically over standard input/output without stdout pollution.
