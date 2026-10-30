# Hisabche QA — Bug & Triage Register (Phase 1 & Phase 2)

**Audit Dates:** 2026-10-14, 2026-10-28, 2026-10-29  
**Target Workspace:** `lolokhan` (`3f19d3ca-b024-4565-b5e3-47a078585c72`)  
**Environment:** Live Web via Antigravity Internal Chromium CDP (Port 64571)

---

## 1. Control & Issue Triage Classification Rules

Every issue is strictly classified into one of three classes:

- **CLASS A — Genuinely Broken:** Handler missing, wrong payload, data contract mismatch, swallowed error, unhandled translation.
- **CLASS B — Correctly Disabled / Blocked by State:** Validation required, missing context, period closed. Not a bug.
- **CLASS C — Role / Environment Restricted:** Requires host platform, camera, printer hardware, or supervisor role. Not a bug.

---

## 2. Phase 2 Verified Defects (Class A Findings)

### BUG-01: Notifications Display Raw Persian Strings on English/Dari UI

- **Class:** CLASS A (Localization / Data Contract)
- **Status:** `IMPLEMENTED_AND_VERIFIED_IN_CODEBASE` (Production database carries historical rows)
- **Symptom:** On `https://hisabche.com/en/dashboard`, opening the notification bell showed Persian text (`صورت‌حساب جدید ایجاد شد`, `ثبت شد INV-000100 صورت‌حساب شماره`) despite English locale.
- **Root Cause:** In `backend/src/services/invoice.service.ts`, `this.notificationService.create()` inserted pre-rendered Persian strings into `notifications.title` and `notifications.body`. The database schema had no dedicated localization columns.
- **Fix Implemented:**
  1. Backend: In `invoice.service.ts`, added structured keys and parameters into the existing `metadata` JSONB column:
     ```ts
     metadata: {
       title_key: 'notifications.invoiceCreated',
       body_key: 'notifications.invoiceRegisteredBody',
       params: { number: invoice.invoice_number },
     }
     ```
  2. Frontend: Created `packages/ui/src/lib/localize-notification.ts` dual-engine:
     - Primary path: inspects `metadata.title_key` and translates via `t(key, params)`.
     - Legacy fallback path: pattern-matches historical pre-rendered Persian strings and maps to localized keys.
  3. Guard test: `backend/src/__tests__/notification-keys.test.ts` (3 tests passed).

---

### BUG-02: Notification & Activity Grammar Defect (`1 activities • 1 days ago`)

- **Class:** CLASS A (Grammar / Localization)
- **Status:** `IMPLEMENTED_AND_UNIT_TESTED`
- **Symptom:** Notification card displayed English plural for singular counts: `1 activities • 1 days ago`.
- **Root Cause:** `packages/ui/src/lib/time-ago.ts` concatenated hardcoded plural units (`activities`, `days ago`) without evaluating count === 1.
- **Fix Implemented:** Added singular branches (`1 activity`, `1 day ago`, `دیروز`, `یک روز پیش`). Unit tests in `time-ago.test.ts` (8/8 passed).

---

### BUG-03: Bidirectional i18n Key Discrepancy

- **Class:** CLASS A (i18n Parity)
- **Status:** `IMPLEMENTED_AND_UNIT_TESTED`
- **Symptom:** `common.alert` and `common.viewDetails` existed in English dictionary (`packages/i18n/messages/en/common.json`) but were absent in Persian (`fa`) and Dari (`af`), causing missing key exceptions if rendered.
- **Fix Implemented:** Added missing keys to `fa/common.json` and `af/common.json`. Created strict bidirectional key-parity test in `packages/i18n/src/__tests__/messages.test.ts` (25 tests passed).

---

## 3. Phase 1 Bug Register (B1–B22)

| Bug ID  | Severity | Class   | Subsystem       | Description & Root Cause                                                                                      | Resolution Status | Live Verification                             | Fix Location                                                                               |
| ------- | -------- | ------- | --------------- | ------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **B1**  | P0       | Class A | Auth / API      | 429 Too Many Requests storm on multi-tab refresh (rate limit 100/min per IP exceeded by 10-20 calls per page) | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `backend/src/index.ts` (OPTIONS preflight excluded, rate limit bumped to 300)              |
| **B2**  | P0       | Class A | Sync Engine     | Outbox transaction deadlocks under concurrent write bursts on mobile SQLite bridge                            | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/local-engine/src/sync/worker.ts`                                                 |
| **B3**  | P1       | Class A | Invoices Hub    | "No invoices have been recorded yet" flash during React Query loading state                                   | FIXED & TESTED    | **PROVED ON LIVE** (`/en/invoices`)           | `packages/ui/src/hooks/invoices/use-invoices-page.ts`                                      |
| **B4**  | P1       | Class A | Invoice Print   | A4 layout clipped right margin in RTL mode; table overflowed printable canvas                                 | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/ui/src/components/ui/invoices/print-template.tsx`                                |
| **B5**  | P1       | Class A | Invoice Form    | Grid input accessible label printed Persian fallback «تعداد» on English form                                  | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/ui/src/components/ui/invoice-builder/grid/grid-cell.tsx`                         |
| **B6**  | P1       | Class A | Dashboard       | Display basis dropdown labels printed hardcoded Persian currency names                                        | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/ui/src/components/ui/dashboard/display-basis-picker.tsx`                         |
| **B7**  | P1       | Class A | Customer Detail | Return balance showed negative prefix mismatch                                                                | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/ui/src/components/ui/customers/customer-detail-view.tsx`                         |
| **B8**  | P1       | Class A | Team Hub        | "No branches defined" warning displayed on cold load despite branches existing                                | FIXED & TESTED    | **PROVED ON LIVE** (`/en/team-and-payroll`)   | `packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx` |
| **B9**  | P1       | Class A | Onboarding      | Repeated step 1 redirect on cold load for established shops                                                   | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `apps/web/app/[lang]/(dashboard)/layout.tsx`                                               |
| **B10** | P2       | Class A | Pluralization   | English grammar bug: "1 conflicts", "1 sales invoices are"                                                    | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/ui/src/components/ui/dashboard/dashboard-container.tsx`                          |
| **B11** | P2       | Class A | Analytics       | KPI cards showing invariant "100% vs last month"                                                              | DOCUMENTED        | Live behavior                                 | `backend/src/services/dashboard`                                                           |
| **B12** | P2       | Class A | POS / Till      | Till recorded balance display vs opening float formula                                                        | DOCUMENTED        | Live behavior                                 | `packages/ui/src/components/ui/pos`                                                        |
| **B13** | P2       | Class A | Warehouse       | Total headline mixes multiple currencies/units                                                                | DOCUMENTED        | Live behavior                                 | `packages/ui/src/components/ui/warehouse`                                                  |
| **B14** | P2       | Class A | Warehouse       | Expiry report header vs list count discrepancy                                                                | DOCUMENTED        | Live behavior                                 | `packages/ui/src/components/ui/warehouse`                                                  |
| **B15** | P2       | Class A | Navigation      | Breadcrumb printed raw route slug `sync-center`                                                               | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/i18n/messages/{en,fa,af}/common.json`                                            |
| **B16** | P2       | Class A | Web Routing     | `/audit` returned 404 on web while existing on desktop                                                        | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `apps/web/app/[lang]/(dashboard)/audit/page.tsx` & `apps/web/app/robots.ts`                |
| **B17** | P2       | Class A | Accessibility   | Multiple `<h1>` tags on `/governance` and `/invoices/new`                                                     | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `approvals-view.tsx`, `approvals-container.tsx`, `invoice-builder-mobile.tsx`              |
| **B18** | P2       | Class A | UX / Security   | Internal ops note "(third database script not run)" shown                                                     | FIXED & TESTED    | **PROVED ON LIVE** (`desktop-developers.png`) | `packages/i18n/messages/{en,fa,af}/common.json`                                            |
| **B19** | P2       | Class A | Customers       | Customer form defaulted phone country prefix to +98                                                           | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `packages/ui/src/components/ui/customers/AddCustomerModal.tsx`                             |
| **B20** | P2       | Class A | Performance     | Multi-second white screen before first paint                                                                  | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `apps/web` prefetch rules                                                                  |
| **B21** | P2       | Class A | SSR / Hydration | Minified React error #418 on 7 routes                                                                         | FIXED & TESTED    | `IMPLEMENTED_NOT_LIVE_VERIFIED`               | `apps/web` date/token serialization                                                        |
| **B22** | P2       | Class A | Accessibility   | Touch targets < 36px on mobile viewports                                                                      | DOCUMENTED        | Live behavior                                 | `docs/qa/DESKTOP-MOBILE-VERIFICATION.md`                                                   |

---

## 4. Class B Triage Items (Correct Behavior / Not Bugs)

### TRIAGE-01: "New Product" Button Behavior on Warehouse Overview

- **Class:** CLASS B (Context Requirement)
- **Observed:** On `/en/warehouse` overview tab, clicking table header action did not immediately open `#product-name`.
- **Investigation:** On `/en/warehouse`, global product creation is accessible via command palette or query parameter (`/en/warehouse?add=true`). Warehouse-specific product addition requires navigating to a specific warehouse (`/en/warehouse?warehouse=<id>`).
- **Conclusion:** Correct by design. Verified by navigating to `/en/warehouse?add=true` where `AddProductModal` opened immediately, allowing creation of `QA-2026-10-29-Prod1`.

### TRIAGE-02: Dashboard Inventory Card Shows "150 AFN" / "1,150 AFN"

- **Class:** CLASS B (Display Metric Clarification)
- **Observed:** Dashboard stock card shows currency (`AFN`) rather than unit count.
- **Investigation:** The card is titled "Total Warehouse Value" (ارزش کل انبار), which calculates monetary valuation: `SUM(quantity * buy_price)`.
  - Baseline: 1 item × 150 AFN = `150 AFN`.
  - After adding `QA-2026-10-29-Prod1` (20 units × 50 AFN = 1,000 AFN): Value updated to `1,150 AFN`.
- **Conclusion:** Correct business accounting metric. Product unit quantities are displayed in product pickers and inventory lists, while the dashboard KPI represents asset valuation.

---

## 5. Class C Triage Items (Hardware / Native Restricted)

### TRIAGE-03: Native Shell & Camera Scanning

- **Class:** CLASS C (Platform Adapter)
- **Observed:** Barcode camera scanner buttons (`camera-scan-button.tsx`) require native host camera permissions and electron/mobile hardware bridges.
- **Conclusion:** Correctly falls back to manual barcode input in browser environments.
