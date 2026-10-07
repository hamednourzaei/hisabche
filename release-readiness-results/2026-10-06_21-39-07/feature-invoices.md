WHAT IT DOES: Core sales and invoicing system.
WHERE IT EXISTS: `services/invoice/`, `apps/web/app/invoices/`
WHAT IS VERIFIED: Creation, offline sync, ledger posting, RLS isolation.
WHAT IS NOT VERIFIED: Real-world PDF rendering edge cases.

Web: `/invoices`
API: `/api/invoices`
Backend: `invoice.service.ts`
DB: `invoices`, `invoice_lines`
Tests: `invoice.pg.test.ts`