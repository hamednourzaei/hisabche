# HISABCHE — RED-TEAM DO-NOT-BUILD LIST

**Auditor:** Independent Red-Team Lead Product Intelligence Architect  
**Evaluation Date:** 2026-10-27  
**Classification:** `OWNER_STRATEGY_OPINION`

The following feature requests, competitor clones, and enterprise proposals are **EXPLICITLY REJECTED OR DEFERRED AS FOUNDER STRATEGY DECISIONS** (`OWNER_STRATEGY_OPINION`). These are not system defects or missing capabilities; they represent deliberate product boundaries to prevent scope creep, avoid duplicate engines, and conserve solo-founder engineering bandwidth.

---

## 1. Enterprise MRP II & Factory Floor Routing (`OWNER_STRATEGY_OPINION`)

- **What competitors have it:** Odoo Enterprise Manufacturing, Microsoft Dynamics 365 Supply Chain.
- **Why rejected for Hisabche:** Hisabche targets retail, wholesale, and light artisanal assembly (bakeries, confectioneries, custom tailoring). Full process manufacturing with work center capacity planning, scrap factor algorithms, and multi-level machine routing adds immense complexity with near-zero SMB adoption.
- **What to do instead:** Keep the existing lightweight Recipe/BOM model (`packages/validation/src/schemas/business-capabilities.ts`) and ensure it decrements ingredients atomically upon finished item sales.
- **Revisit trigger:** Never for the core product. Only as a dedicated vertical module if a paying enterprise customer signs an upfront contract.

---

## 2. Visual Drag-and-Drop Workflow Canvas (`OWNER_STRATEGY_OPINION`)

- **What competitors have it:** Microsoft Power Automate, Shopify Flow, Zoho Deluge.
- **Why rejected for Hisabche:** Visual node-graph canvas builders require enormous UI maintenance, complex state graphs, and create high support costs when users write broken logic.
- **What to do instead:** Pre-configure 5–10 high-value automated triggers (e.g. Low Stock Alert, Negative Balance Warning, Daily WhatsApp Summary, Auto-reversal of cancelled payments) as simple boolean toggles in Settings.
- **Revisit trigger:** Re-evaluate only after reaching >2,000 active paying workspaces.

---

## 3. Public Third-Party Developer Marketplace & App Store (`OWNER_STRATEGY_OPINION`)

- **What competitors have it:** Xero App Store (1,000+ apps), Intuit Developer Network.
- **Why rejected for Hisabche:** App marketplaces require significant developer documentation, SDK versioning, review pipelines, and partner management overhead. In early stages, external developers will not build apps for a platform without existing scale.
- **What to do instead:** Provide the clean Fastify REST API with the OpenAPI SDK generator (`scripts/export-openapi-sdk.mjs`) for merchant IT integrations and custom sync tools.
- **Revisit trigger:** When more than 50 enterprise customers request custom third-party integrations.

---

## 4. Complex In-House Payroll & Social Security Tax Diskette Generator (`OWNER_STRATEGY_OPINION`)

- **What competitors have it:** Sepidar System (دیسکت بیمه و مالیات), QuickBooks Payroll.
- **Why rejected for Hisabche:** Iranian and Afghan tax laws and social security diskette specs change frequently with complex regional deductions. Small businesses in this segment outsource tax filings to external accountants or use official government desktop utility portals.
- **What to do instead:** Maintain accurate staff attendance and gross salary journal postings (`payroll-ledger.test.ts`), and provide clean CSV/Excel exports for external accountants.
- **Revisit trigger:** When customer validation shows that payroll diskettes are a primary churn factor.

---

## 5. Duplicate Universal Engines (Second Sync, Second Accounting Ledger)

- **Monorepo Invariant:** Absolute prohibition against duplicating business logic across apps or verticals.
- **Why rejected:** Monorepo rule §2 strictly enforces: _One of everything — extend, never duplicate._ No second SQLite schema, no second journal posting service, no separate retail vs wholesale invoice calculation engine.
- **What to do instead:** Always extend `packages/validation`, `packages/local-engine`, and `backend/src/services/accounting`.
