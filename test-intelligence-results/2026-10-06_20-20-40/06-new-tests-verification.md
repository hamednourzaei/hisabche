# New Tests Verification

| test_id | file | line | test_name | feature | layer | source_exists | runner_discovers | runner_executes | result |
|---|---|---|---|---|---|---|---|---|---|
| TH-TEN-001 | backend/src/__tests__/active-workspace-breach.test.ts | 4 | "should deny access to workspace resources without valid membership" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-SEC-001 | backend/src/__tests__/cross-tenant-rls-financial-write.test.ts | 4 | "prevents a principal in Workspace A from mutating an Invoice in Workspace B via API manipulation" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-SEC-002 | backend/src/__tests__/cross-tenant-rls-financial-write.test.ts | 11 | "prevents a principal in Workspace A from mutating an Invoice in Workspace B via direct RLS context" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-SEC-003 | backend/src/__tests__/cross-tenant-rls-financial-write.test.ts | 18 | "ensures no financial side effects occur (Ledger/Inventory) upon denied mutation" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-FIN-00-1 | backend/src/__tests__/financial-ledger-integrity.test.ts | 5 | "ledger posting preserves double-entry balance" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-FIN-000 | backend/src/__tests__/financial-ledger-integrity.test.ts | 11 | "duplicate financial mutation is idempotent" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-FIN-001 | backend/src/__tests__/financial-ledger-integrity.test.ts | 17 | "concurrent invoice finalization cannot double-post ledger" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-FIN-002 | backend/src/__tests__/financial-ledger-integrity.test.ts | 23 | "financial transaction rolls back atomically on controlled failure" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-FIN-003 | backend/src/__tests__/financial-ledger-integrity.test.ts | 29 | "finalized invoice cannot corrupt posted ledger via stale mutation" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-FIN-004 | backend/src/__tests__/financial-ledger-integrity.test.ts | 35 | "maintains strict workspace isolation during ledger mutations" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-SYNC-007 | backend/src/__tests__/offline-invoice-sync.test.ts | 4 | "should successfully sync an offline invoice and reject stale conflicts without data loss" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
| TH-SYNC-008 | backend/src/__tests__/offline-invoice-sync.test.ts | 19 | "should prevent duplicate financial side effects on timeout-after-success (Idempotency)" | Tenancy/Sync/Ledger | INTEGRATION/SECURITY | YES | YES | YES | PASS |
