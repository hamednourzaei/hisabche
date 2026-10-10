# QA / Verifier Report

## Flagged Features (Demoted)

- [AI & Content] سیستم مدیریت محتوا (CMS) -> Reason: Evidence explicitly states that no UI file was found in `apps/web` or `packages/ui/src` (Backend only). Status demoted to PARTIAL.
- [Customers & CRM] وصول مطالبات و سلامت مالی (Collections) -> Reason: Lacks an independent/dedicated UI module and relies solely on test files as evidence for backend integration. Status demoted to PARTIAL.
- [Purchasing] پیشنهاد سفارش مجدد (Reorder Suggestions) -> Reason: Frontend implementation path is marked as "نامشخص" (unknown/unclear), indicating weak evidence on the UI side. Status demoted to PARTIAL.
- [HR & Payroll] حضور و غیاب (Attendance) -> Reason: The status is listed as "Implemented (DB Migration Pending)", meaning the feature is not fully operational yet. Status demoted to PARTIAL.
- [HR & Payroll] مدیریت کارمندان و تیم (Employees & Team) -> Reason: Backend evidence is entirely empty ("-"), which is weak evidence for a full-stack feature. Status demoted to PARTIAL.

## Duplicates Identified

- Customer Portal (پورتال عمومی مشتری) found in [Customers & CRM] and [Sales & POS].
- Customer 360 Profile (پروفایل ۳۶۰ درجه مشتری / Payments & Customer 360) found in [Customers & CRM] and [Sales & POS].
- Financial & Profit Reports (گزارش‌های مالی / Operational & Profit Reports) found in [Accounting & Finance] and [Reports & Analytics].
- OAuth Platform (پلتفرم توسعه‌دهندگان / OAuth) found in [Platform & Sync] and [Ecosystem & Workflow].

## Verification Summary

A comprehensive verification of all raw audit files (`*.md`) in the `docs/feature-audit/raw/` directory was completed.

- Most file paths provided as "Evidence" (including backend services like `accounting.service.ts` and `profit-report.domain.ts`, and frontend components) were successfully verified and exist in the actual codebase. There was no widespread hallucination detected.
- Features exhibiting weak evidence, lacking frontend implementations, or blocked by pending database migrations were successfully flagged and demoted to `PARTIAL`.
- Overlapping features that share the same underlying services and domain concepts (e.g., Customer Portal and OAuth) were successfully identified as duplicates across domain boundaries.
