# Two parallel agents — Entitlement + Admin, and Offline Phase 7

Paste **Prompt E** into agent E and **Prompt P7** into agent P7, at the same
time. Both read this whole file first, so each knows what the other owns.

---

## Shared rules (both agents)

Read: `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`,
`docs/offline/OFFLINE-EDITION-PROMPT.md`, `docs/offline/ENTITLEMENT-PROMPT.md`,
`docs/offline/entitlement/00-CONTRACT.md`, `docs/admin/ADMIN-10-PROMPT.md`,
`docs/admin/00-ADMIN-CONTRACT.md` (with the owner's 22 answers).

- No commit/push. No DDL on live Supabase (migration + VERIFY + `*.pg.test.ts`
  in `docs/`; the owner runs them). No `any`, `eslint-disable`, dead code,
  UI theater, hard-coded text or currency. Every i18n key in fa + af + en.
- **Editing discipline:** read each file once, apply all its changes in ONE
  edit, no re-reading to verify, multi-file changes by one node script with
  asserted match counts. Report «files edited: N, edit operations: M».
- **One writer per file.** Before writing, check the ownership table below.
  A file you do not own → write a note in `docs/parallel/handoff.md`
  (who, file, exact change needed) and continue with something else.
- **Shared files** (both need them) have one owner each:

| Shared file                                                         | Owner                                                                                                           | The other agent                                                                                                                                            |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/validation/src/schemas/feature-registry.ts`               | **E**                                                                                                           | P7 imports it read-only                                                                                                                                    |
| `packages/ui/src/lib/capability/**` (incl. `useActionAvailability`) | **P7**                                                                                                          | E sends the entitlement hook-up as a handoff note                                                                                                          |
| `packages/ui/src/components/ui/cloud-required-notice.tsx`           | **P7**                                                                                                          | —                                                                                                                                                          |
| `packages/i18n/messages/{fa,af,en}/common.json`                     | both, **by key family only**: E → `entitlement.*`, `billing.plans.*`, `admin.*`; P7 → `offline.cloudRequired.*` | written ONLY by a node script that reads, adds its own family, and writes in one operation; if the write fails because the file changed, re-run the script |
| `packages/ui/src/index.ts`, `packages/api/src/index.ts` (barrels)   | each agent adds only its own export lines, by script, same rule as i18n                                         | —                                                                                                                                                          |
| `.claude/lessons-learned.md`, `CLAUDE.md`, `BUG-REGISTRY.md`        | **E** writes; P7 puts its lessons in `docs/parallel/handoff.md` and E copies them in at the end                 | —                                                                                                                                                          |

- **Tests:** each agent runs only the test FILES it touched while working.
  **Full suites run only once, at the end, by E, one at a time** (two vitest
  runs at once time out the tree-reading guards). P7 writes «P7 done» in
  `docs/parallel/handoff.md` before E starts the full suites.
- **Builds:** only E, only at the very end, after both agents are done
  (Windows: `pnpm --filter @hisabche/desktop package:win`; Android:
  `pnpm --filter @hisabche/mobile android:release`; report path, size, time).
  Never rebuild better-sqlite3 for Node — tests use `node:sqlite`.
- Never run any `.exe` under `C:\Users\hamed\AppData\Local\Python\`.
- Each agent stops after each of its steps with a Persian report (files, real
  command output, table of real numbers, status label) and waits for «ادامه».

---

## Prompt E — Entitlement core + Admin panel 10/10

```
You are agent E. Read docs/PARALLEL-AGENTS-PROMPT.md fully (shared rules + ownership), then work through these steps, stopping after each one with a Persian report and waiting for «ادامه».

E0 — SECURITY first (P0, small): backend/src/routes/cms.routes.ts uses [authenticate, requireWorkspaceContext], so any customer can create/edit/publish the GLOBAL CMS pages, globals and media. Put the CMS admin routes behind the platform-admin guard used by admin.routes.ts. Tests: workspace member → 403 on every CMS write + media upload; platform admin → allowed; injection-test. Add the bug to .claude/BUG-REGISTRY.md. Also the pending first-run fix: the time zone in the offline first-run form is a prefilled, editable field, not saved silently.

E1 — Feature registry FIRST (P7 depends on it): packages/validation/src/schemas/feature-registry.ts with the rows from docs/offline/entitlement/00-CONTRACT.md (execution: local | server | hybrid, plans). Export it. Write «registry ready» in docs/parallel/handoff.md as soon as tsc passes — P7 is waiting for it. Then the resolver (AVAILABLE | REQUIRES_ONLINE | NOT_ENTITLED | REQUIRES_UPGRADE(plan) | EXHAUSTED | EXPIRED) in packages/validation, pure.

E2 — Entitlement core (ENTITLEMENT-PROMPT Step 1): plans FREE / OFFLINE / ONLINE_500/1000/1500 in plan-pricing.ts (IRR stored, Toman shown) with price versioning; limits in plan-limit-defaults.ts (free.invoices = 50 lifetime; ONLINE_* daily); entitlement.service.ts answers through the resolver; the usage-policy function (owner's answers: imported no, return 1, draft no, cancelled yes; daily by creation time in the workspace's stored zone, never ?tz=); the counter inside InvoiceService.create and every other invoice-creating path; requireEntitlement on routes; export ALWAYS allowed (this changes free's canExportData — test it). Migration entitlement-01 + VERIFY + pg test run twice (REVOKE ALL first). Tests with two currencies and both sides of 50 and 500.

E3 — Signed licence (Step 2): Ed25519 with @noble/curves in packages/validation — report the exact version and STOP for the owner to run `pnpm install` before using it. Issue endpoint (503 LICENSE_SIGNING_NOT_CONFIGURED without the server key — no fallback key, status BLOCKED_EXTERNAL_CREDENTIAL), key id in each licence, revocation list, device activate/release. Tests: valid, expired, wrong workspace/device, tampered byte, clock moved back, no hardware key.

E4 — User side (Step 3): first-run choice Free / Online / Offline after login (reuse onboarding + /billing), lock screen with «اطلاعات کسب‌وکار شما محفوظ است و حذف نشده است…» (read/print/export still open), OFFLINE account on a device → «continue offline / upgrade», OFFLINE account on the web → portal only, upgrade credit breakdown, landing online/offline boxes above pricing (numbers from plan-pricing.ts; landing-claims guard). Send the useActionAvailability entitlement hook-up to P7 as a handoff note — do not edit packages/ui/src/lib/capability/**.

E5 — Admin panel (docs/admin/ADMIN-10-PROMPT.md, contract docs/admin/00-ADMIN-CONTRACT.md): its Steps 1–5 in order — shadcn primitives added once in packages/ui (alert-dialog, command, checkbox, textarea), admin-ui.tsx lists → DataTable then delete the hand-made ones, 8 hubs + redirects, af locale, admin table + roles + Supabase MFA (AAL2 on the backend) + step-up TOTP + append-only audit (retention function is the only delete), plan catalog, subscription lifecycle, entitlements with source, usage, billing ledger, maker–checker, preview/diff + Idempotency-Key, licences, devices, key rotation, fleet health, migration center (state machine, no one-click), reconciliation (read-only), Workspace 360 (Sheet + Tabs), user management, support session, notes/timeline, Ctrl+K command palette, trial-abuse signals, data requests, feature flags (global), system health, jobs, announcements/maintenance. Admin tests on vitest.

E6 — Gate (after «P7 done» in handoff.md): copy P7's lessons into .claude/lessons-learned.md + CLAUDE.md; full suites ONE AT A TIME (backend baseline 5099 with only sales-chart-window red, ui 2286 + 4 known reds, validation, api, local-engine, admin, desktop jest, mobile jest); tsc everywhere; eslint 0 on changed files; admin next build; real HTTP checks (trial 50 → 402, export still 200, ONLINE_500 at 500/day → 402, BILLING admin → 403 on servers, refund by its proposer refused, no fresh TOTP refused, audit row cannot be updated/deleted, tampered licence refused); then Windows + Android builds. Final Persian report with every number.
```

---

## Prompt P7 — Offline Phase 7: «این کار اینترنت می‌خواهد»

```
You are agent P7. Read docs/PARALLEL-AGENTS-PROMPT.md fully (shared rules + ownership), then do Phase 7 of docs/offline/OFFLINE-EDITION-PROMPT.md. Stop after each step with a Persian report and wait for «ادامه».

P7-0 — Plan (no code): from docs/offline/01-CAPABILITY-MATRIX.md list every C-class row (needs the server) with its button/action location (file:line) on web, Windows and Android. Read docs/offline/entitlement/00-CONTRACT.md: the feature-registry keys are the names you must use — no second key list.

P7-1 — Parts that do not need the registry (start now): one shared notice component packages/ui/src/components/ui/cloud-required-notice.tsx (shadcn primitives from @hisabche/ui only, tokens, RTL logical classes) that says at the action, honestly, «این کار اینترنت می‌خواهد» + why + what to do; no fake success, no blank page, no disabled-without-reason button. i18n family offline.cloudRequired.* in fa/af/en via a script (shared-file rule). Tests for the component.

P7-2 — After E writes «registry ready» in docs/parallel/handoff.md: packages/ui/src/lib/capability/ — useActionAvailability(featureKey) built on the registry's `execution` and the device edition (offline edition + execution 'server' → REQUIRES_ONLINE; hybrid → the local part available, the server part REQUIRES_ONLINE). Use the resolver E exports from packages/validation; do not re-derive. Leave a clear seam for E's entitlement hook-up (E sends it as a handoff note; you apply it).

P7-3 — Wire every C-class action from P7-0 to useActionAvailability + the notice. The local engine already answers 501 OFFLINE_NOT_AVAILABLE for unimplemented routes: when that arrives anyway, the same notice shows (never a raw error). The online/cloud edition must look and behave EXACTLY as today — test that.

P7-4 — Gate 7: cloud-required.test.ts covers every C row (fails if a C row has no guarded action); a test that a C action in the offline edition never sends a request; a test that the cloud edition is unchanged. Run only the test files you touched. Write your lessons and «P7 done» (files touched, edit operations, test numbers) in docs/parallel/handoff.md. Then give the owner a short numbered hand checklist: click every C action offline on Windows and Android (after E's final build) and what each must show.
```
