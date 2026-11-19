# WP-18 — Package credits: offline grant

**Baseline:** `b54636fae57806c6d75c710c7621a49c8a3132d0`.
**Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`.

## Gap and fix

The local engine already had consume / reverse / expire / adjust and the shared
`planPackageGrant` rule; only **granting** was online-only (`GRANT_ONLINE_ONLY`). Added
`POST /local-package-credits/grant` which:

- calls the shared `planPackageGrant` rule (no second grant arithmetic),
- refuses a non-positive quantity and a repeated idempotency key (one grant per key),
- deliberately does **not** enqueue a second command: when credit comes from a sale the
  INVOICE is the one server-side grant (`package-grant-outbox.test.ts`); queueing a GRANT
  here would double-grant after sync. The server stays authoritative.

Test `offline-package-grant.test.ts` (4/4): grants a readable balance, idempotent key grants once,
non-positive quantity refused, no duplicate sync command.

The limitation is replaced by the honest `GRANT_ACTIVATION_POLICY_BASIC` (activation/expiry policy
is still basic and fixed per grant), translated in fa/af/en.

## Out of scope

- Live PG/HTTP witness (environment blocked).
- No change to the server grant route or the existing `useGrantPackageCredits` hook.
