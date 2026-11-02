# PROMPT FOR ANOTHER AGENT — M4.2 SERVICE DELIVERY UI & OPERATIONAL VISIBILITY

> Reviewed against the real repository on 1 Nov 2026 (after the M4 integrity audit, `UNIVERSAL-BUSINESS-AUDIT.md` §17).
> The original draft of this prompt contained **six statements the code does not support**; they are corrected here and listed in
> section 2. Do not "restore" the original wording.

You are working in the existing Hisabche monorepo (pnpm + Turbo, branch `main`, large uncommitted working tree). Owner is a
Persian-speaking solo founder. Code, comments and tests are English; every user-facing string exists in `fa`, `af` (Dari) and `en`.

Your task: make the existing Service Delivery capability **usable through the real product UI**, without touching the financial
integrity that the audit established. This is a UI slice. It is not a rewrite and not M5.

---

## 0. Read first (in this order, before any edit)

1. `CLAUDE.md` and `AGENTS.md` (project rules), `.claude/lessons-learned.md` (last ~30 lessons).
2. `docs/architecture/universal-business-core/UNIVERSAL-BUSINESS-AUDIT.md` **§17** (what was fixed and why) and `UNIVERSAL-BUSINESS-PROGRESS.md`.
3. `git status --short` and `git diff --stat`. **Never** `git add -A/-u`, `commit`, `push`, `reset`, `stash`, `checkout --`.
   Other work is in the tree and belongs to the owner; leave it byte-for-byte alone.
4. The code you will build on (read the real files, do not trust any summary):
   - domain: `packages/validation/src/schemas/universal-core/service-delivery.domain.ts`, `package-credit-ledger.domain.ts`
   - hooks: `packages/api/src/hooks/universal-core.ts` (search for the words Service Delivery)
   - device routes: `packages/local-engine/src/routes/service-delivery.ts`, `package-credits.ts`
   - server: `backend/src/services/service-delivery/service-delivery.service.ts`, `backend/src/routes/service-delivery.routes.ts`
   - sync: `packages/app-shell/src/features/sync/sync-engine.ts`, `outbox-stage.ts`, and the sync-centre UI in `packages/app-shell/src/features/sync/`
   - capability / offline contract: `packages/validation/src/schemas/feature-registry.ts`, `offline-endpoint-matrix.ts`, `packages/ui/src/lib/capability/use-action-availability.ts`
   - UI conventions: `.claude/skills/hisabche-ux-consolidation/SKILL.md` (the owner's taste), `packages/ui/src/components/ui/page-hub.tsx`, `HubTabs`, `SegmentedControl`, `DataTable`, `SelectField`, existing dialogs.
5. Graphify first, grep second: `C:/Users/hamed/AppData/Local/Programs/Python/Python313/Scripts/graphify.exe explain "<symbol>"` (full path — the bare name hits an infected install).

## 1. Non-negotiable project rules

- ONE UI for web, Windows and Android: put it in `packages/ui`; `apps/web` page = metadata + `<XContainer />` only; the app-shell (desktop/mobile) mounts the same container. Navigation only through `useLocalePush` / `localizePath`. No physical `left/right/ml/mr` (use `ms-/me-/start-/end-`). Colours only from tokens.
- **A new route is the last resort.** The product has 57 routes / 36 menu items and wants 24 / 11. Service Delivery becomes a **tab (or section) of an existing hub** with `PageHub` / `HubTabs` + at most one `SegmentedControl branch`; the old-URL rule applies if you move anything (`moved` list in `apps/web/next.config.js` and the `<Navigate>` pair in `packages/app-shell/src/app/app.tsx`, guard `route-parity.test.ts`). Pick the hub by reading the navigation (customers or sales are the likely homes) and say why.
- Every list is a `DataTable` (cards under 768px, built in pager; pass `paginate={false}` only if you paginate yourself). Every dropdown is `SelectField` (raw `<select>` is banned). Forms that save open in a modal/express dialog.
- `t()` **throws** on a missing key: add each key to `packages/i18n/messages/{fa,af,en}/common.json`; Dari wording from `.claude/DARI-GLOSSARY.md`; a message with `{placeholder}` is read with `translate.raw()`, not `translate()`. A hook-using screen needs `Container` (guards + notice) vs `Content` (logic) so hooks are never conditional.
- Server text is not a translation: show a CODE-keyed message from a closed list (like `manufacturing-errors.ts`); never put a server sentence into `t()`. Read errors with `apiErrorMessage` / `apiErrorCode` / `useServerFieldErrors` from `@hisabche/api`, never `response.data.error`.
- Anything shown as "unknown" is `null`, never `0`. Money/quantity comes from the server's answer; the client never computes a balance or a debt.
- `placeholderData: []` makes "loading" look like "empty" — do not use it. `enabled: false` also reads as empty: render the reason.
- No `any`, `@ts-ignore`, `eslint-disable`, dead code, theatre tests, mock/sample rows in production UI. `exactOptionalPropertyTypes` is on (`prop?: string | undefined`).
- Do not upgrade Expo 51 / RN 0.74; no New Architecture. No builds unless the owner asked. No subagents: do the work yourself.
- Never read or print `.env`/secrets. No commit/push/merge/deploy. **No DDL on any live database.** If you need SQL, write `docs/*.sql` additive + idempotent + rollback block + a separate `VERIFY-*.sql`, label it `PENDING HUMAN CONFIRMATION`.
- Shell traps on this machine: backticks and `$` inside `node -e` / heredocs get executed or mangled — write scripts with the Write tool and run `node file.mjs`. A formatter rewrites files after save: Read before Edit.
- Tests: write the failing test first and watch it fail for the right reason. Never weaken or delete a test; a guard that locked an old decision is rewritten with the new decision. Injection-test every new guard.
- Report with honest tokens only: `VERIFIED_COMPLETE` needs real HTTP/DB evidence; PostgreSQL tests that did not start are `BLOCKED_EXTERNAL`, never "passed".

## 2. Corrections to the original brief (the code does not support these — do NOT build around them silently)

| Original wording                                                  | What the code actually does                                                                                                                                                             | What to do                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Cancel a session **with a reason**" / "show cancellation reason" | `POST .../cancel` takes no reason; neither SQLite nor PostgreSQL has a cancellation-reason column                                                                                       | Collect the reason in the dialog only if you add it end-to-end (SQL migration `docs/service-delivery-03-*.sql` + VERIFY, local schema v16 + migration test, domain input, both routes, outbox payload, i18n, tests). If you do not, **disable nothing and invent nothing**: cancel without a reason field and report `PARTIALLY_IMPLEMENTED` with this exact gap. Prefer the end-to-end version — it is small. |
| "INVOICE … **creates a receivable**" / "uses the invoice engine"  | Delivering with settlement `invoice` **links an existing invoice** of the same customer (`invoiceId`); nothing creates an invoice                                                       | The dialog must pick an existing invoice of that customer (`SelectField`, from the existing invoice list hook filtered by customer). If the customer has none, say so and offer the existing "new invoice" flow in the existing invoice UI — do not create invoices from this screen. Text must say "links this session to an invoice", not "creates a receivable".                                            |
| "FREE requires **explicit permission**"                           | No capability exists for it; `complementary` needs only a non-empty reason (stored as `settlement_reason`)                                                                              | Require the reason. For the permission: reuse an existing capability only if one clearly fits; otherwise **do not invent one** — list it as `NEEDS_OWNER_DECISION` (it is a permission-policy decision) and gate by the existing `invoice.create` capability like the rest of the screen.                                                                                                                      |
| "Select the settlement **when creating** the session"             | The session stores a _default_ `settlementMethod`; the real choice (package product / invoice / reason) is made **at delivery** and the server refuses a delivery that cannot honour it | Create dialog: choose the default settlement method only. **Deliver dialog: the first question is the settlement**, with its required inputs. Never infer or switch settlement.                                                                                                                                                                                                                                |
| "actual delivery time", "audit history", "branch if required"     | No `delivered_at` column; no per-session event log; no branch-requirement rule                                                                                                          | Show `updatedAt` labelled as "last change" (never as delivery time). Show history only from data that exists (status + settlement + the sync centre entry); otherwise omit the section. Branch: show the field only if the tenant has branches (`useBranches`), optional.                                                                                                                                      |
| "sync-conflicted sessions", "requires reconciliation"             | The outbox keeps a refused command as a visible `REJECTED` entry; the session row stays in its local state; there is **no automatic reconciliation** (owner decision open)              | Read the outbox through the existing `outbox-stage` helpers and show 4 states: pending / confirmed / rejected / needs-attention. A rejected delivery is shown as "the server refused this" with the code-keyed reason and a link to the sync centre. **No retry-with-different-settlement, no automatic undo, no LWW.**                                                                                        |

## 3. Scope — one coherent hub tab

1. **List** (`DataTable`): customer, service, practitioner, date/time, duration, operational status, settlement, **sync state (a separate column)**, branch if the tenant has branches. Search; status + date filters (`TableFilterSelect` in the table's `actions`); loading / error / empty / offline states that say _why_ (see rule on `enabled:false`). No fake rows.
2. **Create dialog**: customer, service offering (only `offering_type = 'service'`), date, start time, duration (end time derived by the existing `calculateSessionDurationMinutes`), optional practitioner (employees), default settlement. Field errors from the server go to the field (`useServerFieldErrors`; controls need `name`/`data-field` equal to the API name). New session is **always `scheduled`** (the API refuses anything else).
3. **Deliver dialog** (the financial step):
   - Load the current session first; if it is not `scheduled`/`in_progress`, show why and disable (a delivered session can never be delivered twice — the UI must not offer the button, and the server replay is a no-op).
   - Settlement is chosen explicitly: **Package credit** → pick the package product (`offering_type = 'package'`, from the customer's package accounts via the existing package-credit hooks), show the balance returned by the server, show the quantity; insufficient → the button is disabled _and_ a server `INSUFFICIENT_PACKAGE_CREDIT` is still rendered if it happens. **Invoice** → pick an existing invoice of this customer. **Free** → reason required.
   - Pass `expectedUpdatedAt` so a stale view is refused (`SESSION_CHANGED` → "this session changed, reload").
   - Attendance refusals (`PRACTITIONER_ABSENT_ON_SESSION_DATE`, `…_ON_LEAVE_…`) are shown as actionable text. The UI never reads or writes attendance itself.
   - Offline: the same dialog works from the device engine; show "saved on this device, not yet confirmed by the server".
4. **Cancel dialog**: show the financial consequence _before_ confirming, derived from the session you already have — package settlement → "the credit will be given back by a new reversal entry"; free → "nothing financial"; **invoice → the action is disabled** with the explanation "a billed service needs a correction, not a cancellation" (the API answers `DELIVERED_INVOICE_CORRECTION_REQUIRED`). Never hide or mutate ledger rows. No refund policy for delivered sessions.
5. **Detail drawer**: only facts that exist (see section 2). Package-credit entry id / invoice id as references (link to the existing invoice detail), settlement reason, status, sync state.
6. **Minimal summary row** on the same tab (scheduled / delivered / cancelled / awaiting sync / rejected counts) computed from the loaded list and the outbox — labelled so _local/pending_ is never presented as _server-confirmed_. No new report endpoint, no reporting engine. If the list is paginated, the counts must come from an exact server count or be omitted (no counting a page).
7. **Permissions**: `useActionAvailability` / `<OfflineGate>` for the offline contract; the routes already require `invoice.read` / `invoice.create`; hiding a button is never the control. Add/adjust the feature-registry + offline-endpoint-matrix rows if any endpoint used has none (guard `offline-matrix-guard.test.ts` fails otherwise), then regenerate `docs/architecture/capability-matrix.csv` and the industry table (`node scripts/generate-capability-matrix-csv.mjs`, `node scripts/industry/generate-coverage-table.mjs`).
8. **Help**: every new screen needs a public help article in `DOCS_ARTICLES` + `ROUTE_DOCS_MAP` (project rule) — keep it short and true; the landing-claims guard rejects claims the code cannot back.

## 4. Tests (write first; red first)

- Domain/API contract stays as is — do not edit `service-delivery.domain.ts` semantics. If you find a domain defect, stop and report it instead of patching around it.
- UI tests with the repo's existing test style (`packages/ui/src/__tests__/`, Testing Library): create-form validation; the deliver dialog refuses to submit without a package / invoice / reason and shows the server balance; insufficient credit; invoice picker only lists this customer's invoices; free needs a reason; a delivered session offers no deliver button; cancel dialog text per settlement and invoice-cancel disabled; sync state rendering for all four states, including **rejected stays visible**; offline notice; i18n keys exist in all three locales (follow `returns-core-screen.test.tsx`); RTL — no physical direction classes in the new files (follow the existing source-reading guards); permission gating.
- Add the new files to the existing structural guards instead of weakening them (`dashboard-page-structure`, `select-consistency`, `no-new-ui-primitives`, `one-ux`, `public-page-namespaces`).
- Injection-test each new guard (temporarily break the rule, see it go red, restore).

## 5. Verification (report real numbers and exit codes)

`packages/validation`, `packages/api`, `packages/ui`, `packages/local-engine`, `packages/app-bridge`, `apps/web` tsc; `vitest` for validation, ui, local-engine, app-bridge; `backend` vitest **excluding** `*.pg.test.ts` (they time out here); eslint on the changed files from each package folder; `git diff --check`; `node scripts/audit/verify-spec-references.mjs`; `node scripts/build-ai-index.mjs`.
Known failures NOT caused by this slice (do not hide, do not "fix" without being asked): `invoice-return-once.test.ts`, `reverse-sales-return.test.ts` (return service now calls `.in()` on a mock), `sync-pull-columns.test.ts` (`offering_type` not in the pull columns — adding it would 500 every pull on a database that has not run `offering-type-01`).

## 6. Out of scope (stop and report instead)

M5; package-return / refund policy; deferred revenue; any new ledger/invoice/payment/attendance/sync engine; generic scheduling or workflow; reassigning a practitioner or `in_progress`/`no_show` transitions (no endpoint exists — report as an API gap, build nothing); automatic reconciliation of a refused delivery (`NEEDS_OWNER_DECISION`); running migrations; claiming PostgreSQL concurrency is proven (it ran on PGlite, single connection).

## 7. Final report (Persian, tables, real numbers)

Files inspected / changed (and count of edits); the hub, tab and routes created or moved; journeys completed (create → deliver → cancel, each with package / invoice / free); settlement behaviour; offline/sync visibility; permission behaviour; i18n evidence for fa/af/en; test counts and exit codes; tsc/eslint results; API/DB blockers with exact missing capability; owner decisions raised; status for **UI** and for **M4 overall** using only: `VERIFIED_COMPLETE · IMPLEMENTED_NOT_LIVE_VERIFIED · PARTIALLY_IMPLEMENTED · BLOCKED_EXTERNAL · NEEDS_OWNER_DECISION · FAILED`.
A rendering UI does not make M4 complete: M4 stays `IMPLEMENTED_NOT_LIVE_VERIFIED` until migrations 01+02 and their VERIFY ran on a real database and `service-delivery-02.pg.test.ts` ran on a working Postgres.
