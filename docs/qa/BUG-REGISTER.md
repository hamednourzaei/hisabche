# Hisabche QA — Bug & Triage Register

**Audit Date:** 2026-10-29  
**Target Workspace:** `lolokhan` (`3f19d3ca-b024-4565-b5e3-47a078585c72`)  
**Environment:** Live Web via Antigravity Internal Chromium CDP (Port 64571)

---

## 1. Control & Issue Triage Classification Rules

Every issue is strictly classified into one of three classes:

- **CLASS A — Genuinely Broken:** Handler missing, wrong payload, data contract mismatch, swallowed error, unhandled translation.
- **CLASS B — Correctly Disabled / Blocked by State:** Validation required, missing context, period closed. Not a bug.
- **CLASS C — Role / Environment Restricted:** Requires host platform, camera, printer hardware, or supervisor role. Not a bug.

---

## 2. Bug Register (Class A Findings)

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

## 3. Class B Triage Items (Correct Behavior / Not Bugs)

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

## 4. Class C Triage Items (Hardware / Native Restricted)

### TRIAGE-03: Native Shell & Camera Scanning

- **Class:** CLASS C (Platform Adapter)
- **Observed:** Barcode camera scanner buttons (`camera-scan-button.tsx`) require native host camera permissions and electron/mobile hardware bridges.
- **Conclusion:** Correctly falls back to manual barcode input in browser environments.
