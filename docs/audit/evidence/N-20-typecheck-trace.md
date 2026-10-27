# N-20 — `toIsoDay` is not imported (type-check failure in five workspaces)

Date: 2026-10-26. Command evidence from `docs/audit/verify-logs/` (`scripts/audit/run-verify.sh`). Nothing changed.

## Verdict

**`CONFIRMED` — definitely a product defect, severity P0 for the build, and it hides two further defects in the same file.**

## 1. The error

`packages/ui/src/components/ui/invoices/invoice-returns-dialog.tsx(44,19): error TS2304: Cannot find name 'toIsoDay'.` — one error, identical in each log.

| Workspace                                                              | Command            | Exit | Log                                     |
| ---------------------------------------------------------------------- | ------------------ | ---- | --------------------------------------- |
| `packages/ui`                                                          | `npx tsc --noEmit` | 2    | `verify-logs/tsc-ui.log`                |
| `packages/app-shell`                                                   | same               | 2    | `tsc-app-shell.log` (via `../ui/src/…`) |
| `apps/web`                                                             | same               | 2    | `tsc-web.log`                           |
| `apps/desktop`                                                         | same               | 2    | `tsc-desktop.log`                       |
| `apps/admin`                                                           | same               | 2    | `tsc-admin.log`                         |
| validation, api, local-engine, app-bridge, formatting, backend, mobile | same               | 0    | —                                       |

(`apps/mobile` compiles because it does not include the UI sources in its program.)

## 2. Cause

The file imports `memo, useCallback, useState`, `useCreateInvoiceReturn`, `RotateCcw`, `Button`, `Dialog…`, `Input` and never imports `toIsoDay`. The function exists (`packages/formatting/src/dates.ts:111`) and is the repository's single place for this conversion (CLAUDE: formatting is only in `packages/formatting`).

## 3. Why the runtime tests did not catch it

1. Vitest and Jest transpile with esbuild/SWC and **do not type-check**; the 2,449 UI tests and the other suites pass (`verify-logs/vitest-ui.log`).
2. The identifier is used inside the click handler (`handleReturn`, line 44), not during render, so merely mounting the dialog would not throw.
3. **No test renders `InvoiceReturnsDialog`**: its only references are the barrel export (`packages/ui/src/index.ts:574`) and the file-name list of `no-new-ui-primitives.test.ts:104`. The guard checks file names and forbidden tags, not types.
4. No gate runs `tsc` for `packages/ui` in the test command the implementer reported.

Runtime effect if the button were reachable: `ReferenceError: toIsoDay is not defined` on click.

## 4. Build impact

`next build` (web, admin) type-checks and would fail. `electron-vite build` (esbuild) would not fail and would ship the latent `ReferenceError`. Not run in this audit (build is out of scope).

## 5. Two defects in the same file (found while reading it)

| Line | Defect                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 47   | `originalLineId: 'line-default'` is a literal; the server needs a real invoice line id, so the request can never match a line — `calculateReturnDocument` throws `Original line line-default not found` even if N-17 were fixed |
| 50   | `reasonCode: reason \|\| 'customer_return'` — `'customer_return'` is not in `ReturnReason` (`returns.domain.ts:12`: `defective, wrong_item, customer_change_of_mind, damaged_in_transit, expired, other`)                       |
| —    | `InvoiceReturnsDialog` is exported and **mounted nowhere** (no import outside the barrel and one test list), so no user can open it today; `useCreateInvoiceReturn` has no other consumer                                       |

So the "return" UI is unreachable, cannot produce a valid request, and does not compile under `tsc`.
