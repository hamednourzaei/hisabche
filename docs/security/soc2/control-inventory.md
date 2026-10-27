# Hisabche SOC 2 Type II Control Inventory

This document maps Hisabche's technical and operational controls to the AICPA Trust Services Criteria (TSC 2017 / 2022 revisions).

## 1. Trust Services Criteria Mapping

### CC1: Control Environment & Governance

| Control ID | AICPA Criteria | Control Description                                                  | Codebase / Repository Evidence                                  | Status      |
| ---------- | -------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | ----------- |
| **CC1.1**  | COSO 1         | Anti-tamper audit trail for financial actions                        | `backend/src/services/audit.service.ts` (`verifyChain` SHA-256) | IMPLEMENTED |
| **CC1.2**  | COSO 2         | Segregation of duties (SoD) between billing, accounting, and cashier | `backend/src/services/authorization/` + `governance.routes.ts`  | IMPLEMENTED |
| **CC1.3**  | COSO 3         | Period lock enforcement to prevent historical modification           | `backend/src/services/accounting/period-lock.service.ts`        | IMPLEMENTED |

### CC2: Communication & Information

| Control ID | AICPA Criteria | Control Description                                | Codebase / Repository Evidence                        | Status      |
| ---------- | -------------- | -------------------------------------------------- | ----------------------------------------------------- | ----------- |
| **CC2.1**  | COSO 14        | Security vulnerability reporting policy            | `apps/web/public/.well-known/security.txt`            | IMPLEMENTED |
| **CC2.2**  | COSO 15        | Real-time system availability and divergence alarm | `packages/validation/src/schemas/divergence-alarm.ts` | IMPLEMENTED |

### CC3: Risk Assessment

| Control ID | AICPA Criteria | Control Description                                  | Codebase / Repository Evidence                    | Status      |
| ---------- | -------------- | ---------------------------------------------------- | ------------------------------------------------- | ----------- |
| **CC3.1**  | COSO 6         | Concurrency safety map for financial write endpoints | `backend/src/utils/concurrency-safety-map.ts`     | IMPLEMENTED |
| **CC3.2**  | COSO 7         | Offline data synchronization conflict handling       | `packages/local-engine/` + `packages/app-bridge/` | IMPLEMENTED |

### CC6: Logical & Physical Access Controls

| Control ID | AICPA Criteria | Control Description                                         | Codebase / Repository Evidence                                         | Status      |
| ---------- | -------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ----------- |
| **CC6.1**  | CC6.1          | Workspace boundary multi-tenancy enforcement                | `TenancyContext`, `requireWorkspaceContext` middleware                 | IMPLEMENTED |
| **CC6.2**  | CC6.2          | Role-based capability checks on mutating routes             | `requireCapability(...)` in Fastify route definitions                  | IMPLEMENTED |
| **CC6.3**  | CC6.3          | Two-factor authentication (TOTP AAL2) for admins and owners | `backend/src/middleware/admin-rbac.middleware.ts`, `mfa.middleware.ts` | IMPLEMENTED |
| **CC6.4**  | CC6.6          | Ephemeral and signed API key authentication                 | `backend/src/services/developer/api-key.service.ts`                    | IMPLEMENTED |

### CC7: System Operations & Incident Response

| Control ID | AICPA Criteria | Control Description                                | Codebase / Repository Evidence         | Status      |
| ---------- | -------------- | -------------------------------------------------- | -------------------------------------- | ----------- |
| **CC7.1**  | CC7.2          | Automated outbox delivery with crash survivability | `backend/src/services/email-outbox.ts` | IMPLEMENTED |
| **CC7.2**  | CC7.3          | Hash-chained tamper detection on audit records     | `GET /api/audit/verify`                | IMPLEMENTED |

### A1: Availability

| Control ID | AICPA Criteria | Control Description                                 | Codebase / Repository Evidence                   | Status      |
| ---------- | -------------- | --------------------------------------------------- | ------------------------------------------------ | ----------- |
| **A1.1**   | A1.2           | Local-first offline operation on network disruption | SQLite database in Electron and mobile shells    | IMPLEMENTED |
| **A1.2**   | A1.3           | Automated backup export and disaster recovery drill | `scripts/dr-restore-drill.mjs` + `BackupService` | IMPLEMENTED |

### PI1: Processing Integrity

| Control ID | AICPA Criteria | Control Description                                   | Codebase / Repository Evidence                              | Status      |
| ---------- | -------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ----------- |
| **PI1.1**  | PI1.1          | Integer-only minor units math (no float arithmetic)   | `packages/validation/src/schemas/money.ts`                  | IMPLEMENTED |
| **PI1.2**  | PI1.2          | Double-entry balance equality (Debit === Credit)      | `ledger.postDocument` in `backend/src/services/accounting/` | IMPLEMENTED |
| **PI1.3**  | PI1.3          | Unknown is not zero principle (`unknown-is-not-zero`) | `backend/src/__tests__/unknown-is-not-zero.test.ts`         | IMPLEMENTED |

### C1 & P1: Confidentiality & Privacy

| Control ID | AICPA Criteria | Control Description                           | Codebase / Repository Evidence          | Status      |
| ---------- | -------------- | --------------------------------------------- | --------------------------------------- | ----------- |
| **C1.1**   | C1.1           | Zero secrets in client packages or code       | Guard test `no-secrets-in-code.test.ts` | IMPLEMENTED |
| **P1.1**   | P1.1           | Tenant data purge upon workspace cancellation | `docs/workspace-deletion.sql`           | IMPLEMENTED |

## 2. Gaps & External Dependencies

- **SOC 2 Type II Third-Party Audit**: Requires 6-month operational observation window conducted by an accredited CPA firm (`BLOCKED_EXTERNAL_CREDENTIAL`).
