# 02 — TARGET ARCHITECTURE & PLATFORM TOPOLOGY

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/02-TARGET-ARCHITECTURE.md`

---

## 1. System Architecture Diagram

```mermaid
flowchart TD
    subgraph UI_Layer ["Shared UI Layer (packages/ui)"]
        UI_Components["React Components & Dialogs"]
        UI_Hooks["React Query Hooks (@hisabche/api)"]
        UI_Resolver["UI Capability Guard (useCapabilities)"]
    end

    subgraph App_Hosts ["Host Applications"]
        Web_App["apps/web (Next.js App Router)"]
        Desktop_App["apps/desktop (Electron + Node SQLite)"]
        Mobile_App["apps/mobile (Expo SDK 51 + WebView SQLite)"]
    end

    subgraph Domain_Core ["Shared Domain Core (@hisabche/validation)"]
        BC_Rules["Universal Business Rules & Calculators"]
        BC_Offerings["Offerings Model (Goods / Services / Packages)"]
        BC_Credits["Package Credit Ledger & Redemption"]
        BC_Financial["Integer Minor-Unit Math & Currency Rules"]
        BC_Costing["FIFO / AVCO Layer Depletion Engine"]
        BC_Accounting["General Ledger Double-Entry Rules"]
        BC_Command["Command Envelope & Domain Event Schema"]
        BC_Lease["Offline Authorization Lease Port"]
    end

    subgraph Adapters ["Execution Adapters"]
        Local_Adapter["packages/local-engine (Local Adapter)\n• SQLite transactions\n• Injected deterministic clock/ID\n• Atomic outbox write"]
        Remote_Adapter["backend/src/services (Remote Adapter)\n• Fastify REST API\n• PostgreSQL PL/pgSQL RPC transactions\n• Tenancy isolation (workspace_id)\n• Idempotency replay cache"]
    end

    subgraph Sync_Infra ["Unified Sync Engine (packages/app-shell)"]
        Outbox["sync_queue (Durable Local Outbox)"]
        Push_Gate["Domain-Routed Push Gate"]
        Pull_Engine["Keyset Snapshot Pull & Delta Log"]
        Conflict_Resolver["Three-Tier Conflict Resolver"]
    end

    UI_Components --> UI_Resolver
    UI_Components --> UI_Hooks
    UI_Hooks --> App_Hosts

    App_Hosts -- "Offline Mode (Desktop/Mobile)" --> Local_Adapter
    App_Hosts -- "Online Direct (Web/API)" --> Remote_Adapter

    Local_Adapter --> Domain_Core
    Remote_Adapter --> Domain_Core

    Local_Adapter --> Outbox
    Outbox --> Push_Gate
    Push_Gate --> Remote_Adapter
    Remote_Adapter --> Pull_Engine
    Pull_Engine --> Local_Adapter
```

---

## 2. Platform Topology & Runtime Matrix

| Platform            | Host Environment                        | Local Database Driver                   | Business Logic Execution                                                   | Offline Support Level                                                    |
| :------------------ | :-------------------------------------- | :-------------------------------------- | :------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Web**             | Modern Browsers (Next.js)               | In-Memory / IndexedDB cache             | Remote Adapter (Fastify + PostgreSQL) with client validation               | Online Primary (`ONLINE_FULL`); graceful degradation on momentary drops  |
| **Windows Desktop** | Electron 31 (Node.js)                   | `better-sqlite3` native compiled SQLite | Local Adapter (`@hisabche/local-engine`) directly in Electron main/preload | Full Offline (`OFFLINE_FULL`) with peer SQLite engine and durable outbox |
| **Android**         | Expo SDK 51 (React Native 0.74 WebView) | SQLite via Native Bridge                | Local Adapter in WebView or background worker                              | Full Offline (`OFFLINE_FULL`) matching desktop local schema              |

---

## 3. Strict Architectural Contracts

1. **Deterministic Execution Contract**:
   The shared domain core is 100% pure TypeScript. It never accesses `Date.now()`, `Math.random()`, `window`, `process.env`, HTTP APIs, or file systems. All time, random identifiers, and database connections are explicitly injected by the executing adapter.
2. **Atomic Local Mutation Contract**:
   When an operation executes offline:
   $$\text{Local Entity Mutation} + \text{Local Balance/Stock Effect} + \text{Outbox Row Insert} \in \text{Single Local Transaction}$$
   A crash at any instant will either rollback all three effects or commit all three effects.
3. **Server Re-validation Contract**:
   The server **NEVER** trusts monetary totals, tax calculations, discounts, or stock adjustments computed by edge devices. When an outbox row is received at the domain endpoint, the server re-runs the identical core rules against authoritative PostgreSQL state.
