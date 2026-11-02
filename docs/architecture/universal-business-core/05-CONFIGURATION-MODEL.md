# 05 — CONFIGURATION MODEL & CAPABILITY RESOLVER SPECIFICATION

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/05-CONFIGURATION-MODEL.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Declarative Workspace Configuration Schema

Every tenant workspace operates under a versioned, declarative configuration document:

```typescript
export interface WorkspaceBusinessConfig {
  readonly workspaceId: string
  readonly businessModel: 'GOODS' | 'SERVICES' | 'PACKAGES' | 'MIXED'
  readonly industryProfile: string // e.g. 'retail', 'education', 'automotive'
  readonly country: string // ISO 3166-1 alpha-2 (e.g. 'AF', 'IR')
  readonly baseCurrency: string // ISO 4217 (e.g. 'AFN', 'IRR', 'USD')
  readonly timezone: string // IANA (e.g. 'Asia/Kabul', 'Asia/Tehran')
  readonly defaultLocale: 'fa' | 'af' | 'en'
  readonly enabledCapabilities: readonly string[]
  readonly terminologyProfile: TerminologyProfile
  readonly dashboardProfile: DashboardProfile
  readonly documentDefaults: DocumentDefaults
  readonly configVersion: number
  readonly rulesVersion: number
  readonly schemaVersion: number
  readonly updatedAt: string
}

export interface TerminologyProfile {
  readonly customerLabel: string // 'مشتری' vs 'دانش‌آموز/زبان‌آموز' vs 'بیمار'
  readonly itemLabel: string // 'کالا/محصول' vs 'خدمت/دوره آموزشی'
  readonly invoiceLabel: string // 'فاکتور فروش' vs 'صورتحساب خدمات'
  readonly warehouseLabel: string // 'انبار' vs 'شعبه/اتاق ارائه'
}

export interface DashboardProfile {
  readonly activeWidgets: readonly string[] // e.g. ['sales_trend', 'active_students', 'unearned_revenue']
}

export interface DocumentDefaults {
  readonly defaultPaymentDueDays: number
  readonly defaultTaxRate: number
  readonly requireCustomerOnSale: boolean
  readonly allowNegativeStock: 'refuse' | 'warn' | 'allow'
}
```

---

## 2. Canonical Capability Resolver: `resolveCapabilities(config)`

The resolver is a **pure, deterministic function** operating identical logic across Client UI, Local Engine, and PostgreSQL backend.

```typescript
export interface ResolverInput {
  readonly config: WorkspaceBusinessConfig
  readonly registry: Readonly<Record<string, CapabilityDefinition>>
  readonly planTier: 'FREE' | 'OFFLINE' | 'ONLINE_500' | 'ONLINE_1000' | 'ONLINE_1500'
}

export interface ResolverOutput {
  readonly activeCapabilities: ReadonlySet<string>
  readonly activeModules: ReadonlySet<string>
  readonly terminology: TerminologyProfile
  readonly rejectedCapabilities: ReadonlyMap<
    string,
    { reason: 'CONFLICT' | 'UNMET_DEPENDENCY' | 'PLAN_RESTRICTION' }
  >
}
```

### 2.1 Resolution Algorithm & Invariants

1. **Plan Boundary**: Filter all requested capabilities by `registry[id].plans.includes(planTier)`. Capabilities outside the tier are marked `PLAN_RESTRICTION`.
2. **Dependency Expansion (Implies & Requires)**:
   - For every authorized capability, recursively activate all `implies`.
   - Verify that all `requires` are present. If a prerequisite is missing and cannot be implied, reject with `UNMET_DEPENDENCY`.
3. **Conflict Resolution**:
   - If two active capabilities list each other in `conflicts`, resolve deterministically via priority ranking or reject both with `CONFLICT`.
4. **Module Derivation**:
   - For every active capability, add all associated `registry[id].modules` to `activeModules`.
   - If a module has zero active capabilities, it is omitted entirely.
5. **Determinism Invariant**:
   $$\text{resolveCapabilities}(C_1) \equiv \text{resolveCapabilities}(C_2) \iff C_1 = C_2$$
   No external state, clock, or asynchronous I/O is consulted during resolution.

---

## 3. Resolver Consumers Across Tiers

1. **Client UI (`packages/ui`)**:
   - Custom hook `useWorkspaceCapabilities()` invokes `resolveCapabilities`.
   - Sidebars, page hubs, form fields, and table columns render conditionally based on `activeCapabilities.has('capability.id')`.
2. **Local Engine (`packages/local-engine`)**:
   - Evaluates context authorization in `packages/local-engine/src/auth.ts`.
   - If an endpoint requires capability $X$ and $X \notin \text{activeCapabilities}$, returns `403 FORBIDDEN` or `501 NOT_AVAILABLE`.
3. **Remote Server (`backend`)**:
   - Fastify pre-handler `requireCapability('capability.id')` checks the resolved set on `request.tenancy.capabilities`.
   - Strictly validates incoming client outbox mutations against the tenant's registered capability state.
