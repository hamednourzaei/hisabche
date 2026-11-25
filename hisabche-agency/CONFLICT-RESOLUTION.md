# Conflict Resolution & Escalation Policy

When two or more agents disagree on design, scope, or readiness:

## 1. Deterministic Precedence Hierarchy

1. **Tier 1 (Highest) — Safety & Project Law:** [AGENTS.md §0](../AGENTS.md) and [SECURITY-POLICY.md](./SECURITY-POLICY.md) override all productivity or convenience suggestions.
2. **Tier 2 — Financial & Data Integrity:** `Financial Controller` & `Database Optimizer` invariants (double-entry balance, integer minor units, unknown=`null`, fail-closed replication/fencing, no LWW for money) override UX shortcuts or caching optimizations.
3. **Tier 3 — Single-Core Architecture:** `Software Architect` rule ("extend canonical core, zero duplicate engines") overrides feature velocity proposals.
4. **Tier 4 — Platform Constraints:** Mobile (`Expo 51`, `RN 0.74`, Legacy WebView) and Desktop (`Electron 31`, `file://`, Windows `esbuild` temp) constraints override framework-ideal suggestions.
5. **Tier 5 — Release Gate Veto:** `Reality Checker` veto requires objective contradictory evidence (failing test or spec gap) and cannot be overridden without closing the underlying proof gap.

## 2. Escalation Ladder

1. **Attempt 1–2 (Within Team):** Lead Architect or Security Architect resolves between specialist implementer and reviewer cleanly.
2. **Attempt 3 (Cross-Team Arbitration):** `Agents Orchestrator` convenes Team Lead + `Reality Checker` + `Evidence Collector` with exact reproduction command and diff.
3. **Unresolved External/Human Blocker:** Stop edits cleanly, record exact blocker in [EVIDENCE-STANDARD.md](./EVIDENCE-STANDARD.md) format, mark `BLOCKED` or `PENDING_HUMAN_CONFIRMATION`, and report to the owner in Persian.
