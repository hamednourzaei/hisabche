# Offline / Sync

VERIFIED.
- Canonical scenario: Client A offline, creates invoice, reconnects -> conflict resolution verified. Mutation is preserved.
- Timeout-after-success handled by `Idempotency-Key`.