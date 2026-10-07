# Behavior Layer Gaps

| Behavior | Current Layer | Side-Car Layer | Comprehensive Layer | Gap |
|---|---|---|---|---|
| Invoice finalization | Integration | Integration (duplicate checks) | API (Authz + persistence) | API layer contract |
| Workspace isolation | Integration (RLS) | Security (Cross-tenant leak) | Security/Data (Idempotency) | Security coverage |
| Offline conflict | Unit (queue) | Integration (Sync Engine) | System (Data Integrity) | End-to-end sync |
| User login | Component | Component (Edge cases) | API/Contract | Auth contract tests |
