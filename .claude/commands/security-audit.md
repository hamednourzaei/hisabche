---
description: Audit authentication, authorization and secret handling
---

Audit $ARGUMENTS (or the current diff) using the `hisabche-auth` skill.

Check:

1. **Shared Supabase client** — any `signInWithPassword` / `signUp` /
   `setSession` on the module-level client in `backend/src/db.ts`? It silently
   drops the process from `service_role` to that user.
   `grep -rn "supabase.auth.sign\|supabase.auth.setSession" backend/src`
2. **Server-side authorization** — is every mutation scoped by the authenticated
   `userId`/`workspaceId`, never a body field?
3. **IDOR** — can an id from a URL or body reach a row the caller does not own?
   Unauthenticated public-token routes must validate ids against the record's
   own data.
4. **Role confusion** — is a workspace `owner` anywhere treated as a platform
   admin?
5. **Session verification** — server-side checks use `getUser()`, never
   `getSession()`.
6. **Secrets** — `SUPABASE_SERVICE_KEY` never in a client bundle; nothing
   sensitive under `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*`.
7. **Status codes** — client conditions returning 500 instead of 403/404/409.
