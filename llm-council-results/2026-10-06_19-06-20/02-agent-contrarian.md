# Agent Report

## Role
Contrarian

## Executive Verdict
The Hisabche project's foundational claim of being an "offline-first" platform is structurally compromised by recent architectural decisions. Crucial domain areas, particularly the heavily developed Workflow & Approval Engine (v1.1) and Financial Transactions, are fundamentally tethered to online-only paradigms. The project is effectively bifurcating into two apps: a legacy offline one and a new online-only one.

The most dangerous hidden assumption in the codebase is the conflation of "optimistic UI via React Query + Supabase Realtime" with true "offline-first sync via WatermelonDB". Developers are relying on `useRealtime` and REST mutations, which will catastrophically fail in the field when connectivity drops, violating the core requirement for the target market.

Furthermore, there is a severe desynchronization between the server's Postgres schema (Drizzle) and the client's local database schema (WatermelonDB). Essential financial tables exist only on the server, while audit tables exist only on the client. This will cause inevitable sync failures, orphaned records, and data integrity losses if pushed to production.

The project looks feature-complete on the surface due to extensive API layers and UI hooks, but underneath, the synchronization engine and offline data models have been neglected. Moving forward without unifying the schemas and migrating new features to the WatermelonDB sync protocol will require massive and expensive rewrites later.

## Strongest Findings
1. **Workflow Engine is Online-Only:** The Workflow & Approval Engine v1.1 is built entirely on REST APIs and Supabase Realtime, completely bypassing the offline-first WatermelonDB architecture.
2. **Missing Offline Transactions:** The `transactions` table exists in Drizzle (server) but is missing from WatermelonDB (client), meaning offline payments and POS receipts are impossible.
3. **Orphaned Client Tables:** The `activities` table exists in the WatermelonDB schema but has been omitted from the Drizzle schema, leading to unavoidable sync crashes.
4. **False Realtime Reliance:** Heavy reliance on `@tanstack/react-query` and Supabase Realtime for workflows masks the lack of true offline capabilities. 

## Repository Evidence
For every important finding:
- **file/path:** `packages/db-schema/src/watermelon.schema.ts` vs `packages/db-schema/src/drizzle.schema.ts`
- **symbol/feature/test/migration:** Missing `workflows`, `workflowSteps`, `workflowInstances`, `workflowActions`, and `transactions` tables in `watermelonSchema`.
- **exact evidence:** `watermelon.schema.ts` defines only `activities`, `invoices`, `products`, `customers`. `drizzle.schema.ts` defines `invoices`, `products`, `customers`, `transactions`, `workflows` and related tables.
- **why it matters:** If tables do not exist in WatermelonDB, the Expo mobile app and offline Electron app cannot read or write that data when disconnected.

- **file/path:** `packages/api/src/hooks/use-workflow.ts`
- **symbol/feature/test/migration:** `useWorkflows`, `useWorkflowInstances`, `usePerformWorkflowAction`
- **exact evidence:** These hooks use direct REST calls (e.g., `apiClient.get('/v1/workflows')`) and rely on `useRealtime` for updates, rather than querying a local WatermelonDB instance.
- **why it matters:** This exposes a fundamental architectural divergence where new features are being built as standard online web apps, completely breaking the offline-first mandate.

- **file/path:** `packages/db-schema/src/drizzle.schema.ts`
- **symbol/feature/test/migration:** `drizzleSchema` export
- **exact evidence:** `activities` table is missing from Drizzle, despite being present in `watermelon.schema.ts`.
- **why it matters:** The sync engine requires parity between client and server schemas. An activity created offline will have no corresponding server table to sync into.

## Risk Assessment
- Critical

## Verified
- Workflows are not implemented in the offline database schema.
- Transactions are missing from the offline database schema.
- Activities are missing from the server database schema.
- Workflow frontend hooks rely on network-dependent REST and Realtime.

## Partially Verified
- Activities might be stored in a different, undiscovered server schema, though `drizzle.schema.ts` is marked as "Shared Drizzle Schema".

## Assumed
- Developers conflated optimistic React Query updates with true offline-first sync.

## Unknown
- How the existing sync engine handles the missing `activities` table on the server during a push.

## Contradictions
- Project claims to be "offline-first" but implements major features (Workflows, Payments/Transactions) as online-only.
- `watermelon.schema.ts` and `drizzle.schema.ts` have wildly divergent table structures.

## Recommendation
Halt all feature development on Workflows and Roles immediately. Force a unification of `watermelon.schema.ts` and `drizzle.schema.ts`. Rewrite all `use-workflow.ts` hooks to interact locally with WatermelonDB, and implement the necessary sync adaptors to push/pull workflow states to the backend. Add `transactions` to WatermelonDB.

## Do Not Build / Do Not Change
Do not build further Escalation Policies or advanced workflow rules until the base Workflow entities are successfully synced and proven to work in airplane mode.

## Confidence
95%

## What Would Change My Mind
Evidence of a separate, dynamic offline-sync implementation (e.g., PowerSync or ElectricSQL) that circumvents WatermelonDB for workflows and transactions, though the presence of `watermelon.schema.ts` strongly implies WatermelonDB is the intended standard.
