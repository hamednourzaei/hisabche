# Hisabche Technical & Capability Gap Analysis

Audit Date: 2026-10-26
Auditor: Agent 1
Assessment Standard: Internal Architectural Completeness, Offline Feature Parity, and Operational Readiness.

---

## 1. Domain Parity Gaps: Cloud vs. Offline Engine

While Hisabche possesses one of the most sophisticated offline architectures in the SaaS accounting sector (56 SQLite tables, dedicated local API router), notable domain asymmetries exist between backend services and local-engine routes:

| Feature / Domain         | Cloud Backend Availability                                   | Offline Local Engine Availability                                           | Gap Impact & Severity                                                                  |
| :----------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **Manufacturing & BOM**  | Complete (manufacturing.routes.ts, manufacturing.service.ts) | **Missing** (packages/local-engine/src/routes/manufacturing.ts absent)      | **MEDIUM:** Factory production runs cannot be logged while disconnected from internet. |
| **AI Workflows & MCP**   | Complete (ai-pipeline.routes.ts, mcp.routes.ts)              | **Missing** (Cloud-only by design)                                          | **LOW:** Expected limitation for LLM-backed services.                                  |
| **Custom Fields Engine** | Complete (custom-fields.routes.ts)                           | **Partial** (No local SQLite table for arbitrary dynamic field definitions) | **LOW-MEDIUM:** Dynamic attributes cannot be customized or edited offline.             |
| **Advanced Approvals**   | Complete (workflow.routes.ts)                                | **Missing** (approvals local route absent)                                  | **LOW:** Multi-stage hierarchical approvals require cloud connectivity.                |

---

## 2. Architectural & Codebase Inconsistencies

### 2.1 Dual Validation and ORM Duplication

- **Postgres Drizzle vs. Direct Supabase-js:** The backend exhibits a dual pattern: backend/src/drizzle-schema.ts defines 12 core tables, while many newer enterprise services utilize raw Supabase query builders and stored procedures (.rpc()). This creates potential divergence between Drizzle types and SQL migration schemas.
- **Repository Pattern Partial Adoption:** packages/db-schema/src/repositories contains only ActivityRepository.ts, indicating an unfinished transition toward repository-pattern abstraction.

### 2.2 Guard Test Discovery & File Naming

- While reversal-ledger.test.ts and cost-unknown-is-not-zero.test.ts strictly protect financial balance invariants and cost boundaries, certain guards specified in general repo conventions (unknown-is-not-zero.test.ts, no-hardcoded-currency.test.ts) reside within packages/ui/src/**tests** rather than the backend root test directory. Both tests exist and are active, but location divergence requires documentation clarity.

---

## 3. Deployment, Scalability & External Dependencies

### 3.1 Live Database Verification Constraint

- Per repository rules (§0.2), coding agents have read-only access and cannot execute DDL or writes against live Supabase instances. All 334 migrations are verified via embedded PostgreSQL test suites (*.pg.test.ts). Live production deployment verification remains PENDING HUMAN CONFIRMATION.

### 3.2 Mobile Platform Native Modules

- Camera barcode scanning (apps/mobile/src/host/camera-scan.ts) requires native camera runtime permissions. In headless CI environments, this remains emulator-verified rather than physical hardware-tested.
