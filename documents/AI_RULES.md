# Hisabche — AI Rules

> Hard guardrails for Claude Code (or any AI agent) working in this repo.
> These override convenience. Violations = wrong behavior, not style nits.

## Non-Negotiables

**AI must:**

1. **Never change the database schema without a migration.**
   - Drizzle migrations in `backend/drizzle/migrations/` (via
     `drizzle-kit`). Any column/table change = new migration + regenerate
     desktop SQLite mirror (`apps/desktop/electron/main/db/schema.ts`) if
     the table is mirrored.
2. **Never remove offline support.**
   - Offline-first is the product. Local DB write → queue → push must stay
     intact on web/desktop/mobile. No feature may be _online-only_ by design
     unless explicitly approved in the task.
3. **Never use `any`** (or `unknown` casts, `ts-ignore`, `ts-expect-error`).
   - Exception: the wrapped `zodToJsonSchema` helper in backend routes —
     and only there.
4. **Never bypass Zod validation.**
   - Every API route body, IPC payload, and form input passes a Zod schema
     from `packages/validation` (or the IPC contract). No `@ts-ignore`,
     no `as any` around schema parse, no hand-rolled `.parse` skips.
5. **Never add hardcoded Persian (or any) UI strings.**
   - All user-facing text through i18n: `packages/i18n`,
     `messages/{fa,en,af}`, `apps/desktop/src/shared/i18n`.
6. **Never create duplicate components.**
   - Reuse `@hisabche/ui` (web/desktop) / `@hisabche/mobile-ui` (mobile)
     first. If a primitive is missing, extend the package — don't fork a
     local copy.
7. **Never silently change money math.**
   - Money = decimal/numeric, never float comparisons; keep `AFN` default;
     preserve `currency` fields.

## Process Rules

- **Read before code.** Before touching an area, read the matching doc:
  - Domain/relations → `DOMAIN_MODEL.md`
  - Schema → `DATABASE_SCHEMA.md`
  - Routes → `API_REFERENCE.md`
  - Auth/roles → `AUTH_AND_PERMISSION.md`
  - Offline/sync → `OFFLINE_SYNC.md`
  - Standards → `CODING_STANDARDS.md`
- **Docs-first for new APIs**: new route = first update `API_REFERENCE.md`
  (contract), then implement. Same for IPC channels
  (`ipc-contract.ts` + doc).
- **Local edits only**; max 3 files unless approved (root manifest).
- **Verify before stopping**: `type-check` (affected packages) + relevant
  tests + build. Never report success on a partial compile.
- **No invented features** in docs or code — mark unverified as
  "Not verified from repository".

## Verification Checklist (every task)

```text
[ ] type-check passes (affected app/package + its consumers)
[ ] lint passes
[ ] tests pass (or runnable reason not to)
[ ] build passes for the changed target
[ ] offline path untouched (or change justified)
[ ] schema change has migration (or explicitly approved)
[ ] strings i18n'd
[ ] no `any` / `ts-ignore` introduced
```

## Release Gate (CI — see TESTING_STRATEGY.md)

Commit must pass: `pnpm lint` → `pnpm type-check` → `pnpm test` →
`pnpm build`. Electron native rebuild (`install-app-deps`) before desktop
packaging. If CI is not yet configured, run the gate manually — do not
ship on "it compiles in my head".
