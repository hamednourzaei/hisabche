# Feature Test Matrix

| Feature | Location | Tests | Test Types | Quality | Coverage | Important Gaps |
|---|---|---:|---|---|---|---|
| Invoices | backend/src/invoices | 450 | Unit/Int | Strong | GOOD | Offline creation |
| Sync | packages/sync | 28 | Unit | Weak | SUPERFICIAL | Conflict resolution |
| Tenancy | backend | 200 | Integration | High | PARTIAL | 29 unmigrated tables |
| Workflows | apps/web | 50 | Unit/Mocked | Low | SUPERFICIAL | Offline capability |
