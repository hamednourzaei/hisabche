# Test Implementation

Implemented `backend/src/__tests__/offline-invoice-sync.test.ts` directly using the `vitest` framework.
Tests the canonical workflow: local outbox -> sync -> backend persistence, focusing on optimistic concurrency and idempotency without relying on browser E2E mocks.
