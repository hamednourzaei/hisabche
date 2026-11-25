# Hisabche Mandatory Evidence Standard

Zero fantasy approvals. Every audit finding, review comment, and readiness decision must comply with this contract.

---

## 1. Five-Layer Integrity Mandate (`AGENTS.md §0.7`)

No capability is verified complete unless proof exists at all five layers:

1. **Layer 1 — Availability:** Route/UI/migration exists and is reachable.
2. **Layer 2 — Execution:** Handler commits and prevents duplicate/replay execution (idempotency keys, FSM checks).
3. **Layer 3 — Outcome Correctness:** Computed minor units, tax, COGS, stock layers, and double-entry debits=credits match domain math.
4. **Layer 4 — Durability & Consistency:** PostgreSQL constraints, RLS/tenancy, outbox, and offline SQLite sync converge cleanly.
5. **Layer 5 — User-Visible Proof:** Correct rendering across `packages/ui`, `apps/web`, `apps/desktop`, and `apps/mobile` in `fa`, `af`, and `en`.

---

## 2. Mandatory Finding Schema

Every finding emitted by any Team A–E agent must use these exact fields:

```markdown
- **Finding ID:** `<TEAM>-<YYYYMMDD>-<NNN>`
- **Category:** Architecture | Security | Accounting | Database | Sync | Mobile | Desktop | UX | i18n | Testing | Infra
- **Severity:** P0-Blocker | P1-High | P2-Medium | P3-Low
- **Exact File & Lines:** `path/to/file.ts#L10-L42`
- **Reproduction Steps:** `<exact HTTP call / test command / user flow>`
- **Actual Command/Test Output:** `<verbatim excerpt>`
- **Expected Behavior:** `<invariant from AGENTS.md / spec>`
- **Observed Behavior:** `<actual defect measured>`
- **Root Cause:** `<CONFIRMED | INFERRED | UNVERIFIED>`
- **Recommended Action:** `<smallest correct fix extending canonical core>`
- **Verification Status:** `VERIFIED_COMPLETE` | `IMPLEMENTED_NOT_LIVE_VERIFIED` | `PARTIALLY_IMPLEMENTED` | `BLOCKED` | `NOT_IMPLEMENTED` | `PENDING_HUMAN_CONFIRMATION`
```

---

## 3. Epistemic Hygiene (Strict Separation)

Reports must explicitly separate five distinct buckets:

1. **Verified Facts:** Directly read file paths, symbols, line numbers, exit codes, and test output observed in the current run.
2. **Engineering Interpretations:** Architectural implications derived from verified code paths.
3. **Assumptions:** Explicit boundaries not measured locally (e.g., live Supabase production row state, Nginx host filesystem).
4. **Recommendations:** Concrete next steps with owner assignment.
5. **Unverified Claims:** Anything not exercised by real execution in this session.

### Five Prohibited Equivocations

An agent **must never**:

1. Confuse a passing unit test (with mocked DB) with PostgreSQL or live production verification.
2. Confuse a registered API route with an authenticated, wired user workflow.
3. Confuse an existing UI component with live server/offline data convergence.
4. Confuse a `docs/*-migration.sql` file with an applied Supabase migration (`PENDING_HUMAN_CONFIRMATION`).
5. Confuse another agent's assertion with independently executed proof.
