# 09 — Multi-Tenant Isolation Audit Evidence

> **Execution Date:** 2026-11-25
> **Security Boundary:** `workspace_id` (`TenancyContext`), never `user_id` or `request.userRole`.

## 1. Verified Isolation Controls

- `backend/src/__tests__/tenancy-isolation.test.ts`: Cross-workspace access returns `403 ForbiddenError('No active workspace membership')` without leaking workspace existence; unknown (`'wizard'`) and `null` roles fail closed.
- `backend/src/__tests__/v59-http-routes.test.ts`: Verified via real Fastify `buildServer()` + `app.inject()` that a `seller` can read only their own commission and is denied team payroll endpoints (`403`).
- `backend/src/routes/workflow.routes.ts:297`: Confirmed `performAction` uses `request.tenancy` (static audit script flag at line 275 was a comment mention false-positive).

## 2. Blocked Verification

- `backend/src/__tests__/tenant-isolation-comprehensive.pg.test.ts` and existing `tenancy-02.pg.test.ts` are `BLOCKED_EXTERNAL` on Windows (`embedded-postgres` `initdb` `0xC0000142`) and require Linux/CI Postgres.
