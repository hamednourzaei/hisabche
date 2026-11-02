# 23 — SYSTEM ACCEPTANCE MATRIX & VALIDATION SCENARIOS

**Document Version**: 1.0.0  
**Status**: APPROVED SPECIFICATION  
**Location**: `docs/architecture/universal-business-core/23-ACCEPTANCE-MATRIX.md`

<!-- target-vocabulary -->

> **Vocabulary note (M0, 1 Nov 2026):** commands, events, tables and function names in this document that do not
> exist in the repository are **target** names of a design, not claims about current code.
> `node scripts/audit/verify-spec-references.mjs` keeps checking every file path here.

---

## 1. Validation Scenarios & Acceptance Criteria

| #      | Business Scenario                  | Setup & Inputs                                                   | Expected Invariant / Outcome                                          | Verification Layer             |
| :----- | :--------------------------------- | :--------------------------------------------------------------- | :-------------------------------------------------------------------- | :----------------------------- |
| **1**  | **Existing Goods Business**        | Grocery store selling 5 items with known buy prices              | FIFO layers depleted; integer profit report matches `buy_price`       | Local SQLite + Backend         |
| **2**  | **New Goods Business**             | New shop onboarded; zero opening stock layers                    | Sale allowed; profit correctly reports `null` (`cost_unknown`)        | Domain Core                    |
| **3**  | **Service Business (Consultant)**  | Lawyer billing 10 hours at 2,000 AFN/hr                          | Zero stock movements; AR and Service Revenue debited/credited         | Full Stack                     |
| **4**  | **Education Business (Tutor)**     | Student buys 20-session English course for 15,000 AFN            | 15,000 AFN to Unearned Revenue; 20 package credits granted            | Package Ledger                 |
| **5**  | **Mixed Business**                 | Dental clinic sells toothbrush (goods) + root canal (service)    | Single invoice: goods deplete stock, service recognized directly      | Parity Harness                 |
| **6**  | **No-Inventory Business**          | Freelancer workspace with `offering.physical_inventory` disabled | Warehouse & stock menus hidden from navigation; 0 stock errors        | UI Capability Guard            |
| **7**  | **Multi-Branch Operations**        | Workspace with Kabul Central and Herat Branch                    | Sales at Herat deplete Herat branch stock and till drawer             | Tenancy & Branch               |
| **8**  | **Multi-Currency Sales**           | Invoice in USD; customer pays in USD                             | Settle strictly in USD; zero conversion cross-summation               | Financial Core                 |
| **9**  | **Partial Payments**               | 10,000 AFN invoice; customer pays 4,000 AFN                      | Invoice status $\rightarrow$ `partial`; remaining AR debt = 6,000 AFN | Payments Core                  |
| **10** | **Customer Return & Deduction**    | Return 2 of 5 items with 10% restocking deduction                | Proportional revenue/tax reversed; 10% withheld as shop fee           | Pilot Slice (Returns)          |
| **11** | **Full Offline Operations**        | Device in airplane mode creates 10 invoices and 3 returns        | All 13 committed locally with outbox rows; stock restored             | Local Engine                   |
| **12** | **Two-Device Stock Conflict**      | 5 units on hand; Device A sells 4 offline, Device B sells 3      | Evaluates `NegativeStockPolicy`; excess sale held for review          | Conflict Resolver              |
| **13** | **Capability Disablement**         | Admin turns off `workforce.payroll` capability                   | Payroll routes return 403; UI hides payroll menus                     | Capability Resolver            |
| **14** | **Multi-Day Offline Version Skew** | App binary updates to v10 while outbox holds v9 rows             | Local migration preserves queue; server processes v9 safely           | Version Compatibility          |
| **15** | **Migration Idempotency**          | Run server migration SQL twice against Postgres                  | Second run succeeds with 0 errors and zero duplicate rows             | Postgres Test (`*.pg.test.ts`) |
| **16** | **Cross-Tenant Isolation**         | User in Tenant A queries invoice ID from Tenant B                | Server and local engine strictly return 404/403                       | Tenant Security                |
| **17** | **Accounting Failure Recovery**    | Simulated crash during general ledger posting                    | Transaction rolled back; outbox retained for retry                    | Unit of Work                   |
| **18** | **Sync Network Drop (ECONNRESET)** | Network drops halfway through 20-mutation push                   | First 10 committed; remaining 10 retry with backoff                   | Sync Engine                    |
| **19** | **Backup & Contract Verification** | Export full database snapshot to compressed backup               | Backup contains all contract tables with zero corrupted rows          | Local Backup                   |
