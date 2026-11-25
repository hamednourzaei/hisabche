# Hisabche Engineering Organization

The Hisabche Engineering Agency organizes **27 specialized agents** (filtered from 268 upstream templates: **26 domain specialists across 5 functional teams** plus **1 cross-cutting Orchestrator**).

```text
                       ┌────────────────────────────┐
                       │   Hisabche Orchestrator    │
                       │ (Task Sizing & Routing)    │
                       └─────────────┬──────────────┘
       ┌──────────────┬──────────────┼──────────────┬──────────────┐
       ▼              ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│   TEAM A   │ │   TEAM B   │ │   TEAM C   │ │   TEAM D   │ │   TEAM E   │
│Architecture│ │ Security & │ │ Platform,  │ │ Product &  │ │  Quality,  │
│ & Core Eng │ │ Financial  │ │  Offline   │ │ Experience │ │Verification│
│            │ │ Integrity  │ │  & Mobile  │ │            │ │ & Release  │
└────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

## Team Summary

| Team        | Focus                                                                                           | Agents (`read-only` vs `implementer`)                                                                                                                                                                                                               | Team Charter                                                   |
| ----------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Team A**  | System Architecture, Single-Core Preservation, Backend, DB & Diff Discipline                    | `Software Architect` _(ro)_, `Backend Architect` _(impl)_, `Database Optimizer` _(impl)_, `Code Reviewer` _(ro)_, `Minimal Change Engineer` _(impl)_                                                                                                | [teams/architecture/README.md](./teams/architecture/README.md) |
| **Team B**  | Threat Modeling, AppSec, PenTest, RLS/Tenant Isolation, Double-Entry Financial Trust            | `Security Architect` _(ro)_, `Application Security Engineer` _(impl)_, `Penetration Tester` _(ro)_, `AI-Generated Code Security Auditor` _(ro)_, `Financial Bookkeeper & Controller` _(ro)_                                                         | [teams/security/README.md](./teams/security/README.md)         |
| **Team C**  | Offline SQLite Engine, Sync Convergence, Desktop Electron, Mobile WebView, SRE, HA/DR, API Perf | `Mobile App Builder` _(impl)_, `Desktop App Engineer` _(impl)_, `Realtime Sync Engineer` _(impl)_, `Database Reliability Engineer` _(impl)_, `SRE` _(ro/ops)_, `DevOps Automator` _(impl)_, `Performance Benchmarker` _(ro)_, `API Tester` _(impl)_ | [teams/platform/README.md](./teams/platform/README.md)         |
| **Team D**  | Product Workflows Across 67 Industries, UX, Shared `packages/ui`, i18n/RTL (`fa`/`af`/`en`)     | `Product Manager` _(ro)_, `UX Researcher` _(ro)_, `UI Designer` _(impl)_, `Internationalization Engineer` _(impl)_                                                                                                                                  | [teams/product/README.md](./teams/product/README.md)           |
| **Team E**  | Automated Verification, Evidence Collection, Regression & Independent Release Sign-off          | `Test Automation Engineer` _(impl)_, `Evidence Collector` _(ro)_, `Test Results Analyzer` _(ro)_, `Reality Checker` _(ro — Veto Gate)_                                                                                                              | [teams/quality/README.md](./teams/quality/README.md)           |
| **Command** | Selective Routing, Token Efficiency, Handoff Continuity                                         | `Agents Orchestrator` _(ro — Dispatcher)_                                                                                                                                                                                                           | [ORCHESTRATION.md](./ORCHESTRATION.md)                         |

## Architectural vs Implementation Boundary

1. **Architecture Authority (Design & Constraints — Team A & B Leads):**
   - `Software Architect`, `Security Architect`, and `Financial Controller` define trust boundaries, RPC transaction contracts, table constraints, and single-core extension points. They **never** ship unreviewed quick hacks and default to `read-only` audit posture.
2. **Implementation Authority (Smallest Correct Diff — Scoped Implementers):**
   - Exactly **one** designated implementation owner edits a file/domain during any task (`Backend Architect`, `Database Optimizer`, `Minimal Change Engineer`, `UI Designer`, `i18n Engineer`, etc.).
3. **Independent Verification Authority (Team E + Reviewers):**
   - An implementer **never** certifies its own completion. Independent reviewers (`Code Reviewer`, `AI Security Auditor`, `Evidence Collector`, `Reality Checker`) verify real outputs against [EVIDENCE-STANDARD.md](./EVIDENCE-STANDARD.md).

## Coordination with Pre-Existing Repo Agents

Existing workspace reviewers in `.claude/agents/` (`domain-reviewer`, `parity-reviewer`, `security-reviewer`, `sales-product-analyst`, `sales-script-writer`) remain **authoritative local guards** preserved unmodified. Hisabche Agency agents explicitly cross-check them on accounting direction, cross-platform UI parity, and auth/RBAC boundaries.
