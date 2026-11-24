# Hisabche Agency Security Policy

This policy binds all agents across Teams A–E and is enforced by **Team B (`Security & Financial Integrity`)**.

## 1. Core Security Non-Negotiables

1. **Tenant Isolation Boundary (`workspace_id`):**
   - `workspace_id` from `request.tenancy.workspaceId` (`requireWorkspaceContext`) is the **only** tenant boundary.
   - `user_id` audits who acted and must never be used alone to filter business data.
   - Every tenant `.eq('id', ...)` query/mutation on service-role clients must pair `.eq('workspace_id', ...)`; every inserted tenant row must include `workspace_id`.
2. **Authorization & RBAC Integrity:**
   - Read workspace role exclusively from `request.tenancy.role`, never `request.userRole` or request body parameters.
   - Mutating workspace routes require `requireWorkspaceContext` + `requireCapability(...)`.
   - Platform admin routes require `adminRoute('<permission>', { stepUp: true })` (verified TOTP `amr`, allowlisted `ADMIN_ALLOWED_EMAILS`).
   - Workspace `owner` is **not** platform admin.
3. **Database Privilege & Migration Security:**
   - Every new PostgreSQL table starts with `REVOKE ALL ON TABLE ... FROM PUBLIC, anon, authenticated`.
   - `SECURITY DEFINER` RPCs must pin `SET search_path = public, pg_temp` and revoke `EXECUTE` from `PUBLIC, anon, authenticated`.
   - Never call `supabase.auth.signInWithPassword`, `signUp`, or `setSession` on the shared service-role `supabase` client (`backend/src/db.ts`); use `createAuthClient()`.
4. **Local Database & Token Verification:**
   - Offline JWT fallback (`jwt-verifier.ts`) activates **only** on upstream transport/5xx failure — never overriding upstream 401/403 revocations — and validates `sub`, finite `exp`, `nbf`, `iat`, `iss`, and `aud`.
   - Local SQLite partition encryption (`per-user-partition.ts`) must bind key derivation to an OS hardware-protected secret + CSPRNG salt (`PBKDF2` + `HKDF`) and seal records with `AES-256-GCM` or native SQLCipher.
5. **Zero Secret Exposure:**
   - Agents must **never** read, print, summarize, duplicate, or move `.env*` files, private keys, or database passwords.
   - `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, and `WRITER_FENCING_SECRET` must never enter `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`, Electron preload/renderer bundles, test fixtures, or logs.

## 2. Financial Correctness & Integrity Precedence

- **Money Types:** Integer minor units on every money calculation path; floats are forbidden.
- **Server Authority:** Prices, taxes, discounts, margins, and totals are derived on the server (`InvoiceService`, `profit-report.domain.ts`, `inventory-costing`, `payments`); client-submitted totals are untrusted.
- **Unknown Is Not Zero:** Missing cost/rate/balance is `null`, never `?? 0` or `|| 0`.
- **Single-Currency Sums:** Never sum amounts across currencies; partition by currency.
- **No LWW on Money/Stock:** Sync conflicts on financial documents never resolve by overwriting newer timestamps silently; idempotency keys, `.rpc()` transactions, and explicit immutable journal reversals are mandatory.
