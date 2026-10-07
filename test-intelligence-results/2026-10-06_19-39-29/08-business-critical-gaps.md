# Business Critical Gaps

- **Tenancy**: 29 tables use user_id.
- **Sync**: Financial fields are dropped silently on sync.
- **Invoices**: Offline concurrency rejection causes data loss.
