# Runbook: Monthly Restore-to-Sandbox Drill

## Purpose

Prove that backups and Point-in-Time Recovery (PITR) are restorable and pass financial integrity checks within RTO (`<= 30 minutes`).

## Prerequisites

- Supabase PITR / daily backups enabled (`BLOCKED_EXTERNAL` until enabled in Supabase Dashboard).
- Staging/Sandbox Supabase project ID and `POST /api/snapshots/:id/restore-to-sandbox`.

## Monthly Steps

1. **Trigger Sandbox Restore:** Restore latest PITR timestamp / snapshot into isolated sandbox DB (never production).
2. **Record Sandbox Request:** Call `POST /api/snapshots/:id/restore-to-sandbox` to log the drill audit entry.
3. **Run Verification SQL:** Execute `docs/VERIFY-*.sql` and trial balance integrity query (`SUM(debit) = SUM(credit)` across all workspaces).
4. **Test Application Smoke:** Point staging API to sandbox DB, run `GET /ready`, login, and read a recent invoice + trial balance.
5. **Tear Down & Log:** Destroy temporary sandbox branch/project and record actual RTO/RPO in the ops log.
