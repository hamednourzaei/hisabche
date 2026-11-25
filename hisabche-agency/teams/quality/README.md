# Team E — Quality, Verification & Release

**Roles:**

- `Test Automation Engineer` _(implementer)_
- `Evidence Collector` _(read-only)_
- `Test Results Analyzer` _(read-only)_
- `Reality Checker` _(read-only final veto gate)_

**Owned Domains:** Automated multi-worker Vitest/Jest/Playwright suites, multi-currency & multi-workspace test fixtures, balance/accounting proof tests, real HTTP `buildServer()` + `app.inject()` coverage, generator freshness checks (`sellable-industries.test.ts`, `migrations-ledger.test.ts`), and 5-Layer Outcome-Driven release certification.

**Hard Boundaries:**

- Never weaken assertions or skip failing guards (`AGENTS.md §0 Rule 8`).
- Default release verdict is `IMPLEMENTED_NOT_LIVE_VERIFIED` or `NEEDS WORK` unless live Postgres/HTTP/browser evidence actually executed over a clean committed tree.
