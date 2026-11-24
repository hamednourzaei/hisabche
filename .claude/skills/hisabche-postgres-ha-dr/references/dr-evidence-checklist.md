# DR evidence checklist

## Backup evidence

- Backup job definition and owner.
- Actual last-success timestamp from provider/job output.
- Backup object location and independent failure domain.
- Encryption and access control evidence.
- Retention and deletion policy.
- WAL archive continuity and gap detection.
- Backup integrity/checksum result.

## Restore evidence

- Isolated target identity.
- Restore command and exact restore point.
- Start/end timestamps.
- Restored database version/extensions.
- Schema object parity.
- Row-count and critical-table reconciliation.
- Journal balance and financial invariant checks.
- Tenant isolation/RLS tests.
- Application smoke tests.
- Actual measured RPO and RTO.

## Failover evidence

- Old writer fenced.
- Exactly one promoted writer.
- Replication position and acknowledged data loss.
- Client pool/DNS refresh behavior.
- In-flight transaction outcome reconciliation.
- No duplicate payment, invoice posting or stock movement.
- Old writer rejoin procedure.

## Status vocabulary

- `VERIFIED_COMPLETE`: real isolated restore/failover evidence supports the exact claim.
- `IMPLEMENTED_NOT_LIVE_VERIFIED`: code/config/runbook exists but no real external drill.
- `VERIFIED_WITH_LIMITATIONS`: tested but known constraints remain.
- `BLOCKED`: credentials, provider feature, owner decision or infrastructure access missing.
- `NOT_IMPLEMENTED`: no implementation found after scoped search.

A green unit test is never sufficient to mark a restore or provider failover verified.
