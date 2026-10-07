# E2E Verification Report

- Canonical Workflow (Invoice Creation -> Versioning -> Idempotency -> Finalization -> Rollback) is verified at the Integration / Database layer via `invoice-write-document.pg.test.ts`.
- Pure browser-driven E2E tests remain 0 to avoid false-confidence mock frameworks.
