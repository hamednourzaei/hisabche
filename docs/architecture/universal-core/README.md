# Universal core — reading order

1. `CORE-INVENTORY.md` — what Hisabche actually has, per domain, with gaps.
2. `CORE-BOUNDARIES.md` — what is core, capability, extension, or industry configuration.
3. `UNIVERSAL-CORE-GAP-ANALYSIS.md` — the prioritised gaps and the decision on each. **Start here if you only read one.**
4. `INDUSTRY-COVERAGE-TABLE.md` (+ `.csv` for filtering) — 24 business models × capability: status, repository evidence, why missing, external source, confidence.
5. `../industry/INDUSTRY-SUPPORT-MATRIX.md` — one line per business model.
6. `../industry/INDUSTRY-ONBOARDING-TAXONOMY.md` — what a user can pick and what picking does.

Regenerate 4 and 5: `node scripts/industry/generate-coverage-table.mjs` (data: `scripts/industry/coverage-data.mjs`). Check: add `--check`.

**Reading the external sources honestly.** Most are vendor pages or forum threads. They show what the trade says it needs, not what a law requires. No national tax, hallmarking or transport-licence source was consulted. That is why most rows are `LOW` confidence.
