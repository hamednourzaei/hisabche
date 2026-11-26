# Hisabche V13 — Module Architecture

## 1. Dependency Boundary Rules

- Core financial & accounting workflows (`AccountingService`, `profit-report.domain.ts`, `ledger`, `costing`, `invoices`, `payments`) remain permanently inside Core Runtime.
- Optional feature modules (`approvals`, `operations`, `manufacturing`, `workforce`, `intelligence`, `marketplace`) are declared via `ModuleExtensionContract` (`packages/updater-core/src/module-contract.ts`) and gated by `PackRouteGate` (`packages/app-shell/src/features/packs/pack-gate.tsx`).
- Industry profiles compose existing capabilities/modules and never copy business logic.

## 2. Real Module Extraction Proof (Slice S7)

- **Chosen Module:** `approvals` (workflow approvals & escalations), proven separable via `packages/app-shell/src/features/packs/prefetch.ts` and `CoreModuleRegistry`.
- **Verification:** `packages/updater-core/src/__tests__/module-proof.test.ts` proves:
  1. `approvals@1.0.0` registers and passes `resolveModuleDependencies`.
  2. `approvals@1.1.0` activates cleanly without modifying unrelated Core files (`0` unrelated Core files edited).
  3. Entitlement revocation (`registry.revokeEntitlement('approvals')`) disables execution while keeping `dataRetained: true` (`I13`).
