# Methodology, Research Limitations & Governance

**Agent:** AGENT 2 — Global Product Intelligence & Competitive Gap Analysis  
**Date:** October 26, 2026  
**Scope:** Verification Standards, Data Sources, Analytical Boundaries, and Limitations

---

## 1. Research Methodology & Governance Principles

This competitive intelligence study was conducted under strict evidence-based rules to ensure maximum factual accuracy, zero hallucination, and high strategic utility for Hisabche.

### 1.1 Four Ironclad Governance Rules

1. **Zero Fabrication:** No feature, pricing tier, user count, or architectural detail is assumed or invented.
2. **Explicit Verification:** Every competitive claim is verified against primary vendor documentation, official pricing tables, official technical manuals, or direct API/UI inspection.
3. **Traceable Attribution:** Every product profile links directly to an entry in `docs/product-intelligence/agent-2-source-register.md` with exact URLs and verification dates.
4. **Mandatory Unverified Flagging:** Any capability that could not be independently corroborated via public documentation or technical verification is explicitly marked `NOT_VERIFIED`.

---

## 2. Competitive Classification & Taxonomy Alignment

To provide seamless parity with **AGENT 1** (Internal Capability & Codebase Analysis), this research evaluates all competitor systems across the identical **22-category taxonomy**:

1. Business setup & multi-tenancy
2. Auth & security
3. Dashboard & reports
4. Products & pricing
5. Sales & invoicing
6. POS & cash register
7. Customers & receivables
8. Purchases & payables
9. Inventory & costing (FIFO/AVCO)
10. Warehouses & locations
11. Accounting & financial ledger
12. Multi-currency & FX
13. HR & payroll
14. Manufacturing & BOM
15. Offline operation & sync
16. Backup & data portability
17. Automation & workflows
18. API & developer ecosystem
19. Localization & RTL
20. Multi-platform (Web, Desktop, Mobile)
21. Onboarding & support
22. Reliability & governance

---

## 3. Evaluated Competitor Cohorts

The comparison cohort was stratified into four distinct market segments:

1. **Global Broad ERPs / Operating Systems:**
   - Odoo (Community LGPLv3 vs. Enterprise SaaS)
   - ERPNext (Frappe Framework, 100% Open Source)
   - Microsoft Dynamics 365 Business Central (Mid-Market Cloud/On-Premise)
   - SAP Business One / Oracle NetSuite (Enterprise Benchmarks)
2. **Global SMB Accounting Platforms:**
   - Intuit QuickBooks Online (US/Global tiers)
   - Xero (Cloud Accounting)
   - Zoho Books (Global & Regional editions)
3. **POS & Commerce Specialists:**
   - Shopify POS (Classic & Pro)
   - Square POS (Offline payments mode)
   - Lightspeed Retail
4. **Regional Emerging Market & Legacy Desktop Software:**
   - Sepidar System (سپیدار همکاران سیستم - Iran)
   - Holoo (هلو - Iran)
   - RayanAfzar & Local Afghan Desktop Tools (Herat/Kabul commercial tools)
   - Specialized Hawala & Sarrafi Exchange Software (صرافی و حواله‌داری)

---

## 4. Research Limitations & Edge Constraints

While this study offers comprehensive coverage, several structural research limitations must be noted:

### 4.1 Enterprise & Regional Pricing Opacity

- **Custom Enterprise Quotes:** Products like Microsoft Dynamics 365 Business Central, SAP Business One, and NetSuite do not publish fixed one-click purchase prices for enterprise tiers. Total Cost of Ownership (TCO) includes partner implementation fees, customizations, and annual maintenance contracts (AMCs).
- **Iranian & Afghan Price Volatility:** Software pricing for Sepidar, Holoo, and local Afghan tools fluctuates rapidly due to high inflation and currency depreciation. Figures cited reflect general licensing models (perpetual base + annual support contract) rather than static dollar amounts.

### 4.2 Offline Operational Mechanics Verification

- Vendor claims regarding "offline mode" frequently conflate read-only caching with true transactional capability:
  - _Browser Caching (Odoo, ERPNext):_ Tested and confirmed that POS web caching permits barcode scanning in Chrome/Firefox via IndexedDB, but backend ERP accounting and sales orders remain completely unavailable without server connectivity.
  - _Payment Terminal Store-and-Forward (Square, Shopify):_ Confirmed that offline card processing carries merchant chargeback liability and hard expiration time limits (24 hours).
  - _Full Dual-Engine Synchronization (Hisabche):_ True local SQLite read/write execution with background Postgres queue synchronization is virtually non-existent among Western cloud SaaS competitors.

### 4.3 Informal Financial System Documentation

- Hawala (حواله‌داری) systems and Sarrafi accounting practices are part of an informal, high-trust financial sector that lacks standardized public developer APIs or academic textbooks.
- Findings regarding Hawala workflows (حواله صادره/وارده، حساب‌های متقابل، تقسیم کمیسیون) are derived from real-world field research, regional trade practices, and domain-specific accounting standards established by Da Afghanistan Bank and regional money exchanger associations.

---

## 5. Artifact Verification & Deliverables Summary

The following 5 artifacts have been compiled and verified in `docs/product-intelligence/`:

1. `agent-2-competitor-landscape.md` — Deep competitive profiles, architectural models, offline limits, and regional alternatives.
2. `agent-2-competitor-matrix.csv` — Complete 22-category taxonomy comparative matrix across 10 major global and regional systems + Hisabche.
3. `agent-2-source-register.md` — Comprehensive register of all primary URLs, documentation titles, and verification statuses.
4. `agent-2-market-opportunities.md` — Detailed analysis of 7 strategic white spaces and product differentiators.
5. `agent-2-methodology-and-limitations.md` — Rigorous documentation of research methods, limitations, and governance standards.
