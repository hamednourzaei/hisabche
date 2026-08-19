---
name: hisabche-auth
description: Anything touching authentication, authorization, roles, workspace membership, platform admin, RLS, the Supabase client, or handling of secrets and tokens.
---

# Auth and security

Read `documents/AUTH_AND_PERMISSION.md` before changing permission logic.

## Three distinct concepts — do not conflate

1. **User** — a Supabase auth account.
2. **Workspace role** — `owner | admin | member | viewer` in `workspace_members`.
   Scoped to one customer's business. Enforced by `requireRole()` in
   `backend/src/services/workspace.service.ts`.
3. **Platform admin** — operates Hisabche itself. Completely separate.
   Currently an env allowlist, `ADMIN_ALLOWED_EMAILS`, checked in
   `backend/src/middleware/platform-admin.middleware.ts` and
   `apps/admin/lib/admin-auth.ts`.

**A workspace `owner` is not a platform admin.** Never grant admin-panel access
from a workspace role.

## The shared Supabase client — critical

`backend/src/db.ts` exports one module-level `supabase` client built with the
**service_role** key.

**Never call `signInWithPassword`, `signUp` or `setSession` on it.**

supabase-js attaches the resulting user session to the client _in memory_ and
sends that user's JWT on every later request. `persistSession: false` does not
prevent this — it only stops the session reaching storage. The process silently
stops being `service_role` and becomes whoever logged in last.

That caused `42501 new row violates row-level security policy for table
"workspace_members"` in production: reads still passed (the owner's own row
matches the SELECT policy) while the INSERT had no policy for `authenticated`.
The boot log still said `service_role` because it is checked before any login.

Use `createAuthClient()` from `backend/src/db.ts` for any session-creating call.
It returns a fresh isolated client. `supabase.auth.admin.*` is fine — the admin
API does not establish a session.

Guard test: `backend/src/__tests__/shared-client-isolation.test.ts`.

## Server-side authorization

Every mutation validates ownership server-side. Frontend checks are UX only.

- Scope reads and writes by `user_id` / `workspace_id` from the authenticated
  request — never from the request body.
- Any id arriving in a body on an unauthenticated endpoint is untrusted.
  `recordCustomerOutcome` validates the `customerId` against the task's own
  snapshot precisely because the public token route has no auth.
- IDOR: an id in a URL proves nothing. Confirm the caller may touch that row.

## Error codes

Client conditions must not be `DatabaseError` (500). Use `NotFoundError` (404),
`ConflictError` (409), `ValidationError` (400), `ForbiddenError` (403).
Routes should surface operational errors rather than swallowing them:

```ts
if (e instanceof BaseError && e.isOperational) {
  return reply.code(e.statusCode).send({ error: e.message })
}
```

A generic `{ error: 'Failed' }` hid an actionable "run this migration" message
for a long time.

## Frontend session

`packages/store/src/slices/auth.slice.ts` persists the user (encrypted storage).
`initAuth` refreshes it from `/auth/me` on hydration — without that, a cached
user never gains fields added later.

Admin panel: server-side checks use `getUser()`, never `getSession()`.
`getSession()` decodes the cookie **without verifying the JWT signature**.

## Secrets

Never commit or log keys. `SUPABASE_SERVICE_KEY` is server-only and must never
reach a client bundle. `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` are public by
definition — put nothing sensitive there.

## Common mistakes

- Session-creating auth calls on the shared client.
- Trusting a workspace role for platform-admin access.
- Trusting a body-supplied `userId` or `workspaceId`.
- `getSession()` for a server-side authorization decision.
- Returning 500 for what is really 403/404/409.
