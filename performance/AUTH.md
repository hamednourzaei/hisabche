# AUTH — how auth and RLS are exercised, and what is not

## The production contract (read from the repository)

All database access goes through supabase-js → PostgREST, and the **only**
tenant boundary is row-level security keyed on `workspace_id`
(`AGENTS.md` §1). Policies call helper functions that `linter-2026-09-14-migration.sql`
moved into a `private` schema — measured present in the lab:
`private.auth_workspace_ids()`, `private.auth_owned_workspace_ids()`,
`private.is_workspace_member(uuid, uuid)`.

## What PostgREST does per request — the contract the lab reproduces

1. Opens/uses a pooled connection;
2. `SET LOCAL ROLE anon | authenticated | service_role`;
3. sets the **`request.jwt.claims`** GUC to the verified JWT payload
   (`{"sub": …, "role": …}`, plus Supabase's older `request.jwt.claim[.sub]`
   spellings that `auth.uid()` also accepts);
4. runs the request's SQL; the transaction ends, and the local settings vanish.

## The lab's reproduction — exact pattern

```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<auth user uuid>","role":"authenticated"}';
-- … the probe query runs here, as the real policy engine sees it …
ROLLBACK;
```

`auth.uid()`, `auth.jwt()` and `auth.role()` come from **Supabase's own
definitions**, not re-invented — they are in
[`scripts/db/bootstrap-shims.sql`](scripts/db/bootstrap-shims.sql), which reads
the same `request.jwt.claims` GUC PostgREST sets. Service-role behaviour uses
`SET LOCAL ROLE service_role`; the shim creates that role with `BYPASSRLS`
exactly as Supabase does.

**What this proves (true):** policy predicates, `WITH CHECK` clauses, helper
functions, grants and revokes — evaluated by the real engine, under the real
role, with real claims.

**What this does not prove (NOT TESTABLE locally):** JWT issuance, expiry and
refresh (GoTrue); the request→GUC plumbing itself (PostgREST); API-key and
service-key handling; and the browser/desktop client behaviour on top of them.

## What the shim provides, and why each piece exists

| Piece                                                                                            | Why the migrations need it                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| roles `anon`, `authenticated` (NOLOGIN), `service_role` (NOLOGIN, **BYPASSRLS**)                 | RLS is written against these roles; three migrations and the policies reference them                                               |
| **Supabase's default-grant behaviour** — new tables are born with ALL granted to the three roles | so the migrations' `REVOKE` statements mean the same thing here as in production; without it, a missing REVOKE would look harmless |
| `auth` schema: `auth.uid()/jwt()/role()` + `auth.users(id)` as an FK target                      | `auth.uid()` appears in 45 docs files; `auth.users(id)` is an FK target in 10                                                      |
| `storage.buckets` / `storage.objects` (RLS on)                                                   | four migrations insert buckets; one policy targets `storage.objects`                                                               |
| empty `supabase_realtime` publication                                                            | three migrations add tables to it (the product's realtime is its own websocket, see `PARITY.md` §5)                                |
| the one account `CREATE-MY-WORKSPACE.sql` names                                                  | see `status/M1.md` §“deviations” — the file refuses to run without it                                                              |

## The probe suite (M2, against the real tables)

- Seed first, then probe — otherwise "zero rows" could just mean "empty
  database". M2 therefore seeds two workspaces with real documents before any
  RLS probe runs.
- **Positive control per table:** a member of workspace A reads A's rows
  (non-zero), then a non-member reads the same table and gets zero — the same
  template the repository's own `scripts/verify-rls.mjs` describes, which
  cannot run locally because it needs a real signed-in user over HTTP.
- **Write probes:** an authenticated member attempting to INSERT/UPDATE a row
  carrying a foreign `workspace_id` must be refused by `WITH CHECK`
  (a refusal is the pass condition; a write that succeeds is a FAILURE and the
  row is removed).
- **Role sweep:** `anon` sees nothing from any tenant table; `service_role`
  behaves as production service-role (bypasses RLS), which is what the backend
  uses when it must.
- Scope: **every** table with RLS enabled in the rebuilt database (240 of 240
  tables at M1 — measured; the suite enumerates them from `pg_class`, it does
  not trust a hand-written list).
