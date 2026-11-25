# Workflow 1 — Architecture Audit

**Default Profile:** `STANDARD` or `CRITICAL` (`--maxWorkers=8` for verification)

## Sequence

1. **`Software Architect` (`hisabche-software-architect`)** inspects module boundaries, `CODEBASE_MAP.md`, and checks against `AGENTS.md §2` for duplicated cores or cyclic imports.
2. **`Backend Architect` (`hisabche-backend-architect`)** verifies Fastify route -> service -> `*.domain.ts` separation, transaction RPC usage, and `allowedHeaders` / response schema fidelity.
3. **`Database Optimizer` (`hisabche-database-optimizer`)** inspects schema migrations, indexes, constraints (`NOT VALID`/`VALIDATE`), `VERIFY-*` coverage, and `MIGRATIONS-PENDING.md`.
4. **`Code Reviewer` (`hisabche-code-reviewer`)** independently cross-checks findings against actual source lines.
5. **`Evidence Collector` (`hisabche-evidence-collector`)** attaches verbatim file paths, line numbers, and `tsc`/`vitest`/`eslint` output.
6. **Architecture Lead (`hisabche-software-architect`)** issues consolidated Architecture Audit report.

## Required Outputs

- Architecture & boundary map (touchpoints vs canonical single core)
- Dependency & cycle check (`pnpm code-intel impact`)
- Duplication analysis (any second model/formula/component flagged `P0/P1`)
- Technical debt & migration backlog (`docs/MIGRATIONS-PENDING.md`)
- Prioritized recommendations formatted per `EVIDENCE-STANDARD.md`
