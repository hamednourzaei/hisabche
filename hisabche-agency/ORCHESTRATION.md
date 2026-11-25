# Hisabche Orchestration & Efficiency Doctrine

Adapted from upstream NEXUS orchestration, constrained strictly for **zero waste, single-core safety, and high-signal evidence**.

---

## 1. Cost & Token Efficiency Mandate (Three Task Profiles)

Never spawn the entire agency on every task. Match team size strictly to risk:

| Profile           | When to Use                                                                             | Agents Invoked                                                                                                                                                                                  | Parallelization Pattern                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`LIGHTWEIGHT`** | Isolated bug fix, copy/i18n fix, single UI tweak                                        | **1 implementer** (`Minimal Change Engineer` or domain specialist) + **1 reviewer** (`Code Reviewer`) when touching auth/money                                                                  | Read targeted `code-intel` slice only; skip domain surveys                                                |
| **`STANDARD`**    | New API route + shared UI tab, schema migration + service, offline parity item          | **1 architecture/design lead** (`Software Architect` / `Product Manager`) + **relevant implementers** (sequential or non-overlapping files) + **1 independent reviewer** + `Evidence Collector` | Read-only analysis in parallel; single file owner per edit target                                         |
| **`CRITICAL`**    | Ledger/posting changes, RLS/tenancy, HA/DR failover, sync engine, release certification | Lead Architect + Security Architect + Financial Controller + Implementers + Test Automation + `Evidence Collector` + **`Reality Checker` final gate**                                           | Strict read-only parallel audit -> single-owner remediation -> full multi-worker suite (`--maxWorkers=8`) |

### Anti-Waste Guardrails

1. **Index Before Grep:** Query `.ai/codebase/CODEBASE_MAP.md` or `pnpm code-intel` before broad searches.
2. **Evidence Reuse:** Pass exact file paths, line ranges, and previous command output summaries in handoffs so downstream agents never re-read 1,000-line files blindly.
3. **Max Retry Circuit:** If a Dev ↔ QA fix loop fails **3 times** on the same defect, halt edits and escalate via [CONFLICT-RESOLUTION.md](./CONFLICT-RESOLUTION.md).
4. **Honest Metrics:** Never invent token savings percentages or execution latency numbers.

---

## 2. Single Implementation Owner Law

- **Parallel reads are safe; parallel overlapping writes are forbidden.**
- For any file or tightly coupled module (`InvoiceService`, `accounting.domain.ts`, `offline-endpoint-matrix.ts`), exactly **one** implementer holds the write token at a time.
- Shared multi-locale/generator updates (`messages/{fa,af,en}/common.json`, `scripts/industry/*`) run cleanly after implementation edits settle.

---

## 3. Handoff Envelope

Every inter-agent handoff passes the exact structured packet defined in [TASK-TEMPLATES.md](./TASK-TEMPLATES.md):

1. `Task ID & Profile` (`LIGHTWEIGHT` | `STANDARD` | `CRITICAL`)
2. `Confirmed Scope & Touched Paths`
3. `Verified Evidence So Far` (commands + exit codes + line numbers)
4. `Open Questions / Blockers`
5. `Required Acceptance Criteria for Next Agent`
