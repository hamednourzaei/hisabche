# Hisabche QA — Localization (i18n) & RTL Verification Audit

**Audit Date:** 2026-10-29  
**Supported Locales:** `en` (English), `fa` (Persian), `af` (Afghan Dari)  
**Strict Laws:** Dari is NOT Pashto, Dari has authentic vocabulary (`بل`, `جنس`, `گدام`, `قرض`), bidirectional key parity required, RTL logical properties only.

---

## 1. Notification Localization Architecture

### 1.1 The Production Defect

On the live site (`https://hisabche.com/en/dashboard`), the notification bell popover displayed Persian strings (`صورت‌حساب جدید ایجاد شد`, `ثبت شد INV-000100 صورت‌حساب شماره`) on an otherwise English interface.

### 1.2 Why Regex Parsing was Initially Used

The production Supabase database contains hundreds of historical notification records where `title` and `body` were pre-rendered into Persian text at write time (`backend/src/services/invoice.service.ts`). The `notifications` table has no dedicated `title_key` or `body_key` columns. Relying exclusively on key lookups would leave all existing notifications untranslated in English and Dari.

### 1.3 The Permanent Dual-Engine Architecture

1. **Backend Structured Keys (`backend/src/services/invoice.service.ts`):**
   Future notification records write structured localization keys and dynamic parameters directly into the existing `metadata` JSONB column (requiring zero DDL schema migrations):
   ```ts
   metadata: {
     title_key: 'notifications.invoiceCreated',
     body_key: 'notifications.invoiceRegisteredBody',
     params: { number: invoice.invoice_number },
     invoice_number: invoice.invoice_number,
     total: invoice.total,
     currency: invoice.currency,
     customer_name: customerName,
   }
   ```
   For payment notifications:
   ```ts
   metadata: {
     title_key: 'notifications.invoicePaid',
     body_key: 'notifications.invoicePaidBody',
     params: { number: invoice.invoice_number },
   }
   ```
2. **Frontend Dual-Engine (`packages/ui/src/lib/localize-notification.ts`):**
   - **Primary Route:** If `metadata.title_key` or `metadata.body_key` is present, it looks up the key in the active i18n dictionary and passes `metadata.params`. This is 100% robust and decoupled from wording.
   - **Legacy Fallback Route:** If no keys exist in metadata (for historical database records), it pattern-matches common Persian notification strings and translates them into localized catalog messages.
3. **Backend Test Suite:**
   Created `backend/src/__tests__/notification-keys.test.ts` (3 tests passed) verifying that `InvoiceService` populates `title_key`, `body_key`, and `params`, and that all keys exist across `en`, `fa`, and `af` message dictionaries.

### 1.4 Notification Generators Still Using Raw Strings (Audit Catalog)

The following backend services still insert raw text into notifications and should be transitioned to structured `metadata.title_key` / `metadata.body_key` in future backend tasks:

1. `backend/src/services/crm/crm.service.ts` (lines 260, 293: task assigned to employee, task status changed).
2. `backend/src/services/workflow.service.ts` (line 754: workflow approval/step notifications).
3. `backend/src/services/event-log.service.ts` (line 221: system audit alerts).
4. `backend/src/plugins/job-scheduler.plugin.ts` (line 41: background job run notifications).
5. `backend/src/workers/divergence-alarm.worker.ts` (accounting ledger discrepancy alerts).

---

## 2. Bidirectional i18n Key Parity

- **Test Suite:** `packages/i18n/src/__tests__/messages.test.ts`
- **Key Count:** 2,190 keys per catalog.
- **Parity Verification:** The test iterates through every key path in `en`, `fa`, and `af`, ensuring 100% identical tree structure. Caught and resolved missing keys `common.alert` and `common.viewDetails`. All 25 tests pass green.

---

## 3. Relative Time & Pluralization Grammar

- **File:** `packages/ui/src/lib/time-ago.ts`
- **Problem:** Displayed `1 activities • 1 days ago`.
- **Fix:** Implemented singular branches:
  - English: `1 activity`, `1 day ago`
  - Persian: `۱ فعالیت`, `دیروز` / `۱ روز پیش`
  - Dari: `۱ فعالیت`, `دیروز` / `۱ روز قبل`
- **Verification:** `packages/ui/src/lib/__tests__/time-ago.test.ts` passed (8/8 tests).

---

## 4. Dari Vocabulary & RTL Compliance

- **Vocabulary Standards:**
  - Invoice: `بل` (Dari) vs `فاکتور` (Persian)
  - Product/Item: `جنس` (Dari) vs `کالا` (Persian)
  - Debt/Receivable: `قرض` (Dari) vs `بدهی` / `طلب` (Persian)
  - Warehouse: `گدام` (Dari) vs `انبار` (Persian)
  - Relative time: `قبل` (Dari) vs `پیش` (Persian)
- **RTL Logical Properties:**
  All UI layout rules strictly enforce logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`, `border-e`, `border-s`). Zero bare `left` or `right` positional attributes on directional UI elements. Verified in `packages/ui/src/__tests__/rtl-logical-properties.test.ts` (11/11 tests passed).
