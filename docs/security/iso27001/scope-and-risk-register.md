# Hisabche ISO/IEC 27001:2022 Scope & Risk Register

## 1. Information Security Management System (ISMS) Scope

The scope of the Hisabche ISMS covers the development, operation, and maintenance of the Hisabche SaaS application, including:

- Cloud-hosted web application and backend API services.
- Offline-first local engine (Electron and mobile clients).
- Customer financial records, general ledger, inventory data, and personal identifiable information (PII).

## 2. Risk Assessment Methodology

Risks are evaluated using a 5x5 Likelihood and Impact matrix (Score = Likelihood × Impact, scale 1–25).

- High (15–25): Mandatory architectural guard / automated test.
- Medium (8–14): Procedural control + monitoring.
- Low (1–7): Accepted risk.

## 3. Risk Register

| Risk ID  | Asset / Process   | Threat Description                            | Inherent Risk | Existing Codebase Control                                                   | Residual Risk |
| -------- | ----------------- | --------------------------------------------- | ------------- | --------------------------------------------------------------------------- | ------------- |
| **R-01** | Multi-tenant DB   | Cross-tenant data leak (BOLA)                 | High (20)     | `TenancyContext` parameter on all services, automated tenant isolation test | Low (4)       |
| **R-02** | Accounting Ledger | Asymmetric journal entries (debit !== credit) | High (25)     | `ledger.postDocument` atomic Postgres function + guard tests                | Low (2)       |
| **R-03** | Currency Math     | Floating-point rounding drift                 | High (20)     | Integer minor units on money path, `round2` and `toInvoiceCurrency`         | Low (2)       |
| **R-04** | Offline Engine    | Outdated tax rates on local client            | Medium (12)   | Frozen tax snapshots on invoices (`tax_snapshot`), drift detection          | Low (4)       |
| **R-05** | API Key Access    | Leaked API key used without restriction       | High (20)     | Scoped keys (`ConnectorScope`), display prefix, SHA-256 storage             | Low (4)       |
| **R-06** | Audit Trail       | Log tampering or deletion                     | High (16)     | SHA-256 hash chaining (`verifyChain` in `AuditService`)                     | Low (3)       |
| **R-07** | Admin Panel       | Account takeover of admin role                | High (25)     | Mandatory TOTP AAL2 MFA (`requireAdminAal2`)                                | Low (5)       |
