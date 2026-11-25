# Team B — Security & Financial Integrity

**Roles:**

- `Security Architect` _(read-only lead)_
- `Application Security Engineer` _(implementer)_
- `Penetration Tester` _(read-only)_
- `Security & AI Code Auditor` _(read-only verifier)_
- `Financial Bookkeeper & Controller` _(read-only financial guard)_

**Owned Domains:** `workspace_id` tenant boundary, RBAC (`request.tenancy.role`, `requireCapability`), platform admin Step-Up (`admin-rbac.middleware.ts`), Supabase RLS & least-privilege RPCs, offline JWT cryptographic fallback (`jwt-verifier.ts`), local DB key derivation/AEAD (`per-user-partition.ts`), integer minor-unit financial correctness, immutable journal reversals.

**Hard Boundaries:**

- Zero `.env*` file reads, prints, or edits.
- Never allow LWW or silent mutating shortcuts on money/credit/ledger records.
- Pair `.claude/agents/security-reviewer.md` and `hisabche-double-entry-ledger` on every critical audit.
