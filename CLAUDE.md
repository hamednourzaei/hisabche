# CLAUDE.md — Hisabche

Accounting, invoicing and inventory for shops in Afghanistan and Iran. Persian
and Dari first, RTL first, offline-tolerant.

## Layout

pnpm workspaces + Turborepo. **pnpm only — never npm or yarn.**

```
apps/web        Next.js 16 App Router · /[lang]/(dashboard)/… · the visual source of truth
apps/desktop    Electron + Vite + react-router · mounts the SAME screens as web
apps/mobile     Expo 51 + React Native · native screens, shared semantics
apps/admin      Next.js · platform admin panel, separate port (3040)
backend/        Fastify + Supabase · its own workspace, installed separately
packages/       shared code — see below
```

`backend/` is **not** in `apps/`. CI installs it with `cd backend && pnpm install`.

### Packages and dependency direction

```
ui-contract, design-tokens, formatting, validation   ← no deps on other packages
i18n, store, auth-core                               ← foundation
api            → auth-core, store
ui             → api, store, ui-contract, design-tokens, formatting   (web + desktop + admin)
mobile-ui      → design-tokens                                        (mobile only)
```

Apps depend on packages. **Packages never import from apps.** `packages/ui` must
stay self-contained — it uses relative imports internally, never `@/`.

## The three renderers

`packages/ui` is the single UI implementation for web, desktop and admin.
Desktop mounts the same containers through `@hisabche/ui/screens` and its routes
mirror web's paths exactly, so containers need no per-platform branching.
`apps/desktop/src/shims/` maps `next-intl`, `next/navigation`, `next/link` and
`next/image` onto desktop equivalents.

Mobile is genuinely native React Native — same product, same words, same
semantics, different renderer. Never add `react-native-web` or a WebView to make
it "share" UI.

**Before building any screen: check whether `packages/ui` already has it.**

## Non-negotiable

- TypeScript strict, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. No `any`, no `ts-ignore`, no `eslint-disable`,
  no loosening tsconfig to make something compile.
- Every user-facing string goes through i18n in **fa, af and en**. A missing key
  fails `packages/i18n`'s parity test.
- Colors, spacing, radius, typography come from `packages/design-tokens`. No
  hardcoded hex or px where a token exists.
- Validation is Zod in `packages/validation`, shared by client and server.
- Authorization is enforced **server-side**. Frontend checks are UX only.
- Never invent a table or column when an existing model can carry the data.
  Schema changes need a migration in `docs/` plus graceful fallback in code.
- Don't duplicate business logic. Reuse the service.
- Preserve offline-first behaviour and web/desktop/mobile parity.

## Money, units, direction

These are the domain's sharp edges. Get them wrong and the product lies to a
shopkeeper about their money.

- An invoice's `type` is `sale | purchase`. A row with no type is a **sale** —
  that is the convention every query, export and derivation uses. Never hardcode
  `sale`.
- A purchase must never count as sales revenue; a sale must never count as cost.
- Quantity, unit and weight are three different things. "10 grams of gold" is
  `quantity: 10, unit: 'gram'`. "1 necklace weighing 12.5g" is
  `quantity: 1, unit: 'piece', weightGrams: 12.5`. Never collapse them.
- A party's role (buyer / seller / both) is **derived from invoice direction**,
  never stored. `customers.type` means payment terms (cash/credit) — do not
  repurpose it.

## Commands

```bash
pnpm type-check      # all workspaces — must be green before you finish
pnpm test            # vitest (packages, backend) + jest (mobile, desktop)
pnpm lint
pnpm build
```

Per-app builds: `cd apps/web && npx next build`,
`cd apps/desktop && npx electron-vite build`.

After deleting a web route, `rm -rf apps/web/.next/types` or type-check fails on
a stale generated file.

## Running it locally

`pnpm dev` at the root does **not** start the backend — `backend/` is outside
the turbo pipeline. Run `cd backend && pnpm dev`; it listens on **10000**.
Dev ports: web **3039**, admin **3040**, backend **10000**.

- `NEXT_PUBLIC_API_URL` must already include `/api`
  (`http://localhost:10000/api`). `packages/api` falls back to
  `https://api.hisabche.com/api` and does not append the path — see
  `packages/api/src/__tests__/normalize-base-url.test.ts`. Omitting it sends
  login to `/auth/login`, a protected route that answers "Missing authorization
  header", which reads like bad credentials but is bad config.
- New dev origins must be added to the CORS allowlist in `backend/src/index.ts`,
  or every browser call fails preflight.
- Git Bash on Windows rewrites URL paths: `export MSYS_NO_PATHCONV=1` before
  curling `/fa/about`.
- `npx next build` has been OOM-killed (exit 137). Retry with
  `NODE_OPTIONS=--max-old-space-size=4096`.

**Never run `taskkill /F /IM node.exe /T`.** It kills the user's backend, web
and admin servers along with yours. Kill the specific PID.

## Testing

Add a regression test for every real bug you fix. Never weaken an assertion,
skip a test, or delete a failing one to go green — find the cause.

## Where the truth lives

Read the relevant doc before changing that area; don't re-derive it:

| Area                      | Document                                 |
| ------------------------- | ---------------------------------------- |
| Entities and invariants   | `documents/DOMAIN_MODEL.md`              |
| API contract (docs-first) | `documents/API_REFERENCE.md`             |
| Schema                    | `documents/DATABASE_SCHEMA.md`           |
| Migration policy          | `documents/DATABASE_MIGRATION_POLICY.md` |
| Auth and permissions      | `documents/AUTH_AND_PERMISSION.md`       |
| Offline and sync          | `documents/OFFLINE_SYNC.md`              |
| Errors                    | `documents/ERROR_HANDLING.md`            |
| Style                     | `documents/CODING_STANDARDS.md`          |

Skills in `.claude/skills/` cover the workflows; they point at files rather than
restating them.

## Working style

Investigate enough to be right. Several production bugs in this codebase —
routes that could never resolve, a client that silently dropped its service
role, translation keys that never existed — were invisible until someone read
the surrounding code instead of the failing line. When a symptom does not match
the obvious cause, keep looking.

Say plainly what you did and did not do. If a test fails, show it.
