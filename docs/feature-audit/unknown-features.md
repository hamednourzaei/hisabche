# UNKNOWN Features Resolution

## Feature: # Accounting & Finance Audit

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: # AI & Content Domain Audit

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: چت هوش مصنوعی و پایپ‌لاین (AI Chat & MCP Pipeline)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: Backend: backend/src/routes/ai-chat.routes.ts<br>Test: backend/src/**tests**/mcp-gateway.test.ts
- **Evidence still missing**: No DB Schema, No Web UI
- **Files to inspect**: ai-chat, mcp
- **Final status**: BACKEND_ONLY
- **Confidence**: HIGH

## Feature: بلاگ و هوش محتوایی (Blog & Content Intelligence)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: backend/src/**tests**/content-intelligence-schema.test.ts<br>Backend: backend/src/routes/blog.routes.ts<br>UI: apps/web/app/[lang]/blog/blog-shared.tsx<br>Test: backend/src/**tests**/blog-ai-writer.test.ts
- **Evidence still missing**: None
- **Files to inspect**: blog, content-intelligence
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: سیستم مدیریت محتوا (CMS)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/cms-foundation-migration.sql<br>Backend: backend/src/routes/cms.routes.ts
- **Evidence still missing**: No Web UI, No Tests
- **Files to inspect**: cms
- **Final status**: BACKEND_ONLY
- **Confidence**: HIGH

## Feature: کمپین‌ها و نظرسنجی (Campaigns & NPS)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/campaigns-01-migration.sql<br>Backend: backend/src/routes/campaigns.routes.ts<br>UI: packages/ui/src/components/ui/campaigns/campaigns-container.tsx<br>Test: backend/src/**tests**/campaign-service.test.ts
- **Evidence still missing**: None
- **Files to inspect**: campaign, nps
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: هوش مالی و پیش‌بینی (Financial Intelligence)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: Backend: backend/src/routes/intelligence-forecast.routes.ts<br>Test: backend/src/**tests**/forecast-followup.test.ts
- **Evidence still missing**: No DB Schema, No Web UI
- **Files to inspect**: financial-intelligence, forecast
- **Final status**: BACKEND_ONLY
- **Confidence**: HIGH

## Feature: لیست ویژگی‌های یافت شده

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: مدیریت و لیست مشتریان (Customers)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/customer-360-phase3-migration.sql<br>Backend: backend/src/routes/customer-portal.routes.ts<br>UI: apps/web/app/[lang]/(dashboard)/customers/loading.tsx<br>Test: backend/src/**tests**/customer-balance-integrity.test.ts
- **Evidence still missing**: None
- **Files to inspect**: customer
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: پروفایل ۳۶۰ درجه مشتری

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: Backend: backend/src/routes/customer-profile.routes.ts<br>UI: packages/ui/src/components/ui/customers/customer-profile-panel.tsx<br>Test: backend/src/**tests**/customer-profile-core.test.ts
- **Evidence still missing**: No DB Schema
- **Files to inspect**: customer-profile
- **Final status**: PARTIAL
- **Confidence**: MEDIUM

## Feature: سیستم CRM و مدیریت تسک‌ها

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/task-assignment-migration.sql<br>Backend: backend/src/routes/crm.routes.ts<br>UI: apps/web/app/[lang]/public-task/layout.tsx<br>Test: backend/src/**tests**/crm-core.test.ts
- **Evidence still missing**: None
- **Files to inspect**: crm, task
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: پورتال عمومی مشتری (Customer Portal)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: Backend: backend/src/routes/customer-portal.routes.ts<br>UI: packages/ui/src/components/ui/customers/customer-portal-panel.tsx<br>Test: backend/src/**tests**/customer-portal.test.ts
- **Evidence still missing**: No DB Schema
- **Files to inspect**: customer-portal
- **Final status**: PARTIAL
- **Confidence**: MEDIUM

## Feature: برنامه ریفرال (Referral System)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/referral-system-migration.sql<br>Backend: backend/src/routes/referral.routes.ts<br>UI: packages/ui/src/components/ui/referrals/referrals-view.tsx<br>Test: backend/src/**tests**/referral-programme.test.ts
- **Evidence still missing**: None
- **Files to inspect**: referral
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: وصول مطالبات و سلامت مالی (Collections)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/late-fees-01-migration.sql<br>Backend: backend/src/routes/late-fees.routes.ts<br>UI: packages/ui/src/components/ui/invoice-detail/invoice-late-fee-panel.tsx<br>Test: backend/src/**tests**/collections-engine.test.ts
- **Evidence still missing**: None
- **Files to inspect**: collection, late-fee
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: Backend

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: Tests

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: حضور و غیاب (Attendance)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/attendance-01-migration.sql<br>Backend: backend/src/routes/attendance.routes.ts<br>UI: packages/ui/src/components/ui/team-and-payroll/attendance-sheet.tsx<br>Test: backend/src/**tests**/attendance-service.test.ts
- **Evidence still missing**: None
- **Files to inspect**: attendance
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: # Inventory & Manufacturing Audit

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: ﻿# Platform & Sync Audit

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: 1

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: 2

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: 3

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: 4

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: 5

- **Current UNKNOWN reason**: Markdown parsing artifact from raw audit files.
- **Evidence already present**: None
- **Evidence still missing**: Backend, UI, DB, Tests
- **Files to inspect**: Varies
- **Final status**: MISSING
- **Confidence**: HIGH

## Feature: 1. Invoices (فاکتور فروش و خرید)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: backend/src/**tests**/invoice-schema-degradation.test.ts<br>Backend: backend/src/routes/invoice-pdf.routes.ts<br>UI: apps/web/app/[lang]/(dashboard)/invoices/loading.tsx<br>Test: backend/src/**tests**/invoice-derived-money.test.ts
- **Evidence still missing**: None
- **Files to inspect**: invoice
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: 2. POS / Till (صندوق فروشگاهی)

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/pos-session-label-01-migration.sql<br>Backend: backend/src/routes/pos.routes.ts<br>UI: apps/web/postcss.config.js<br>Test: backend/src/**tests**/depreciation-posting.test.ts
- **Evidence still missing**: None
- **Files to inspect**: pos, till
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: 3. Payments & Customer 360

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: DB: docs/customer-360-phase3-migration.sql<br>Backend: backend/src/routes/payments.routes.ts<br>UI: packages/ui/src/components/ui/customers/customer-360-header.tsx<br>Test: backend/src/**tests**/payments-ar-ap-rules.test.ts
- **Evidence still missing**: None
- **Files to inspect**: payment, customer-360
- **Final status**: COMPLETE
- **Confidence**: HIGH

## Feature: 4. Customer Portal

- **Current UNKNOWN reason**: Missing explicit evidence in initial audit.
- **Evidence already present**: Backend: backend/src/routes/customer-portal.routes.ts<br>UI: packages/ui/src/components/ui/customers/customer-portal-panel.tsx<br>Test: backend/src/**tests**/customer-portal.test.ts
- **Evidence still missing**: No DB Schema
- **Files to inspect**: customer-portal
- **Final status**: PARTIAL
- **Confidence**: MEDIUM
