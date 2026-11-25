# Team A — Architecture & Core Engineering

**Roles:**

- `Software Architect` _(read-only lead)_
- `Backend Architect` _(implementer)_
- `Database Optimizer` _(implementer)_
- `Code Reviewer` _(read-only verifier)_
- `Minimal Change Engineer` _(implementer)_

**Owned Domains:** Single-core integrity (`AGENTS.md §2`), dependency direction across monorepo packages, Fastify services/routes/validation, PostgreSQL schema/migration pairs (`docs/*-migration.sql` + `VERIFY-*` + `*.pg.test.ts`), diff discipline.

**Hard Boundaries:**

- Never introduce a parallel ledger, costing, permission, sync, tax, or UI engine.
- Extend `InvoiceService`, `AccountingService`, `PaymentsService`, `InventoryCostingService`, `profit-report.domain.ts` instead of copying logic.
- Pair `.claude/agents/domain-reviewer.md` on all money/invoice/inventory changes.
