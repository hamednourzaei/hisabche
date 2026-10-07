WHAT IT DOES: CRM entity management for sales and orders.
WHERE IT EXISTS: `services/crm/`
WHAT IS VERIFIED: CRUD operations, RLS tenancy isolation.
WHAT IS NOT VERIFIED: High-volume bulk imports.

Web: `/customers`
API: `/api/customers`
Backend: `customer.service.ts`
DB: `customers`
Tests: `customer.test.ts`