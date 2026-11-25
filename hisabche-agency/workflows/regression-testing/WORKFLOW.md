# Workflow — Regression Testing & Ledger Sync

**Default Profile:** `STANDARD` (`--maxWorkers=8` for Vitest suites)

## Sequence

1. **`Test Automation Engineer` (`hisabche-test-automation-engineer`)** runs targeted failure tests first (and guard inversion checks on newly written guards per `AGENTS.md §6`).
2. **`API Tester` (`hisabche-api-tester`)** runs `generate-capability-matrix-csv`, `generate-coverage-table`, `generate-sellable`, `unused-hooks`, and `pending-ledger` whenever routes, migrations, or hooks change.
3. **`Test Results Analyzer` (`hisabche-test-results-analyzer`)** executes full workspace verification:
   - `tsc --noEmit` across all 11 packages
   - `eslint` on every edited file
   - All 15 test suites (`Vitest --maxWorkers=8`, `Jest --maxWorkers=4`)
   - Separates local `*.pg.test.ts` Windows environment blocks transparently.
4. **`Evidence Collector` (`hisabche-evidence-collector`)** archives verbatim pass/fail/skip totals with exit codes.
