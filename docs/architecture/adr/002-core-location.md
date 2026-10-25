# ADR-002: Location of Shared Business Domain Core

## Status

Accepted

## Context

Hisabche requires a single, unified source of business rules and financial math consumed identically by:

1. The backend server (Fastify / Postgres / Supabase).
2. The local device engine (`packages/local-engine` running on Windows Electron and Android SQLite).
3. The client application layer for immediate optimistic validation and UI derivation.

A key hazard in multi-package monorepos is creating parallel packages (e.g. `packages/domain/`), introducing duplicate dependency trees, barrel cycles, and competing rule sources (violating Guardrail G2).

## Decision

1. **The Shared Domain Core lives strictly in `packages/validation`**:
   - `packages/validation` already holds existing pure schemas and business rules (`invoice-grid.ts`, `accounting.reports.ts`, `profit-report.domain.ts`, `payroll-rules.ts`, `installment-plan.ts`, etc.).
   - It has zero dependencies on Node runtime internals, browser DOM, Fastify, Supabase, or SQLite.
   - It is purely portable to Hermes (React Native), Electron (Chromium/Node), and standard Node.js server environments.
2. **Internal Organization**:
   - Pure domain modules and ports are organized cleanly inside `packages/validation/src/schemas/`.
   - The public barrel `packages/validation/src/index.ts` remains the single import point for consumers (`@hisabche/validation`).
3. **No Parallel Domain Package**:
   - Creation of `packages/domain/` or similar parallel packages is **explicitly rejected**.
   - Backend services retain only I/O, database persistence, authentication, and caching. Any remaining pure calculations in `backend/src/services/**` are moved to `packages/validation`.

## Rejected Alternatives

- **Creating `packages/domain`**: Rejected. Would create a second home for rules, require updating 40+ package.json files, increase build complexity, and violate the monorepo principle of extending existing modules.
- **Keeping rules in `backend/src/services` and importing from backend**: Rejected. Backend imports Node-specific and database-specific libraries (`@fastify/*`, `@arcjet/node`, `supabase-js`) that cannot execute on Hermes / React Native or Electron renderer.

## Consequences

- Guaranteed portable execution across server, desktop, and mobile.
- Zero code duplication between offline engine and server.
- Existing imports from `@hisabche/validation` remain stable.
