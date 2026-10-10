# Catalog Reconciliation

- RAW feature count: 15
- CATALOG feature count before: 45
- Missing from catalog: 11

## Missing Features (To be restored)

- مدیریت کارمندان و تیم (Employees & Team) (hr.md)
- حضور و غیاب (Attendance) (hr.md)
- شیفت‌های کاری (Work Shifts) (hr.md)
- حقوق و دستمزد (Payroll) (hr.md)
- تایم‌شیت (Timesheets) (hr.md)
- 1 (purchasing.md)
- 2 (purchasing.md)
- 3 (purchasing.md)
- 4 (purchasing.md)
- 5 (purchasing.md)
- # Reports & Analytics (Domain Feature Audit) (reports.md)

## Suspicious Evidence / Architecture Violations

- **Invoicing (فاکتور فروش و خرید)**: Invoicing uses supabase/postgrest directly for mutations - this is an architecture violation (bypasses domain engine).

## Final Reconciled Counts

Total Features: 15
COMPLETE: 4
PARTIAL: 1
BACKEND_ONLY: 0
UI_ONLY: 0
WIRED_BUT_UNVERIFIED: 0
EXISTS_BUT_UNUSED: 0
PLANNED_ONLY: 0
NOT_FOUND: 0
UNKNOWN: 9
I: 1
