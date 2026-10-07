# ACTION PRIORITY

## P0:
- **Deploy the Backend:** Request deployment authority and ship the existing codebase to production. This is the absolute blocker for all tenancy work.
- **Unblock Subscription Migration:** Run Part 3 of `docs/subscription-workspace-migration.sql` on production data and review the output of verification checks 4a/4c.

## P1:
- **Fix Mobile Build:** Resolve the Hermes binary issue (`hermesc.exe`) to restore the Expo mobile build pipeline.

## P2:
- **Unify Configuration:** Consolidate `ADMIN_ALLOWED_EMAILS` from `apps/admin/.env` and `backend/.env` into a single source of truth.

## P3:
- **Design Remaining Tenancy:** Begin planning the migration of the 29 legacy tables from `user_id` to `workspace_id`.
- **Admin UI Testing:** Introduce test infrastructure for the Admin UI to prevent regressions.

---

## SINGLE NEXT ACTION:
Deploy the backend to production.
