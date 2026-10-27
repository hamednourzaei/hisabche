# Hisabche — Master Execution Prompt (run every prompt from this session, in order, to completion)

You are the implementation agent. This file does **not** restate the prompts. It names them by path, gives the order, says which one wins when two disagree, and sets one completion rule for the whole job. **Open each prompt file and follow it as written.** Do not summarise them, shorten them, or substitute your own reading.

## 0. Rules that apply to every prompt below

- Do not commit or push. Do not spawn subagents. The owner pushes.
- No DDL on the live Supabase database. Migrations are files in `docs/` with a rollback block, a `VERIFY-*.sql`, and a `*.pg.test.ts` that runs them twice. Report `PENDING HUMAN CONFIRMATION` until the owner reports a real result.
- Read `CLAUDE.md`, `.claude/hisabche-session-rules` (skill) and `git status` first. The tree already holds approved uncommitted work (filter contract, `fetchProducts` via the engine, shared unit-conversion rule, SCHEMA_VERSION 8, Settings industry editor, five new onboarding keys, the industry-support note, the universal-core documents). **Preserve it.** Read a diff before touching any file in it.
- Status labels only: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `BLOCKED_EXTERNAL_CREDENTIAL`. No HTTP/database proof → not `VERIFIED_COMPLETE`.
- Run suites **sequentially**. Machine traps: `TEMP`/`TMP` → `.pgtest/tmp`; backend tsc needs `NODE_OPTIONS=--max-old-space-size=6144`; ~80 `|pg|` backend files fail from the environment (initdb permissions, shared memory error 1314) — try every fix in `INDUSTRY-PROFILES-CLOSE-ALL-PROMPT.md` §5 and record each attempt; Defender flags Neshta, never run pip-made `.exe`.
- Build only after every suite is green. Trust artifact timestamps, not tool messages.

## 1. The prompts, in execution order

Each row is a file already in the repository. Open it.

| #   | File                                                        | What it is                                                                                                            | State when you start                                                                    |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | `docs/architecture/LOCAL-FIRST-CORE-PROMPT.md`              | Local-first core: matrix, gates, shadow verification, divergence alarm                                                | Largely implemented (commit `06a4f490`); verify its claims by running, then move on     |
| 2   | `docs/architecture/LOCAL-FIRST-CORE-FINAL-PROMPT.md`        | Finishing pass for #1                                                                                                 | Same — close anything it lists that is still open                                       |
| 3   | `docs/SEO/SEO-AGENT-PROMPT.md`                              | Technical SEO audit and fixes                                                                                         | Implemented and committed (`41031ed2`); re-run its checks, do not redo the work         |
| 4   | `docs/SEO/INTERNAL-LINKING-AGENT-PROMPT.md`                 | Internal-link graph                                                                                                   | Same as #3                                                                              |
| 5   | `docs/architecture/INDUSTRY-PROFILES-AGENT-PROMPT.md`       | One core + industry profiles and capabilities                                                                         | Partly implemented in the tree                                                          |
| 6   | `docs/architecture/EVIDENCE-FIRST-SUPPLEMENT-PROMPT.md`     | Research before coding; web evidence                                                                                  | Applies to #5, #7, #8, #9, #10                                                          |
| 7   | `docs/architecture/INDUSTRY-DIFF-DOC-PROMPT.md`             | Document what changes per industry (gold vs cup shop)                                                                 | Done (`docs/architecture/industry/INDUSTRY-DIFFERENCES.md`); refresh after code changes |
| 8   | `docs/architecture/INDUSTRY-PROFILES-FINISH-PROMPT.md`      | Close the profile debts A–G (parity, offline persistence, Settings editor, dashboard order, full suites, tsc, builds) | Partly done — verify each lettered item by running it                                   |
| 9   | `docs/architecture/INDUSTRY-PROFILES-CLOSE-ALL-PROMPT.md`   | Same debts with every owner decision already made; zero "remaining"                                                   | Authoritative over #8                                                                   |
| 10  | `docs/architecture/UNIVERSAL-CORE-ADDENDUM-PROMPT.md`       | Evidence table, onboarding branches, strict stop rule                                                                 | Documents done in `docs/architecture/universal-core/`; keep them in sync                |
| 11  | `docs/architecture/universal-core/CLOSE-ALL-GAPS-PROMPT.md` | Implement every gap G-04…G-17, fully tested, production-ready                                                         | **The main body of remaining work**                                                     |

Two earlier prompts exist only as chat text, not as files: the **filter-contract audit** (unset values never become filters, online and offline) and the **Universal Business Core audit + supplementary evidence matrix** pasted by the owner. Their outputs are already in the tree — `packages/validation/src/schemas/filter-contract.ts` with its guards, and the six documents under `docs/architecture/universal-core/` plus `docs/architecture/industry/INDUSTRY-ONBOARDING-TAXONOMY.md` and `INDUSTRY-SUPPORT-MATRIX.md`. Treat those artefacts as the specification and keep their guards green; do not recreate the prompts.

## 2. Precedence when two prompts disagree

1. `universal-core/CLOSE-ALL-GAPS-PROMPT.md` (#11)
2. `UNIVERSAL-CORE-ADDENDUM-PROMPT.md` (#10)
3. `INDUSTRY-PROFILES-CLOSE-ALL-PROMPT.md` (#9)
4. `EVIDENCE-FIRST-SUPPLEMENT-PROMPT.md` (#6)
5. everything else, newest first.

A later prompt that has made a decision replaces an earlier prompt's "ask the owner". **Never stop to ask.** Pick the decision given, or the safe reversible default, implement it, and record it in the report.

## 3. How to work

1. **Audit before action.** For #1–#4 and #7–#8, do not trust the old report. Run the checks the prompt names, list what is genuinely open, and fix only that. If a prompt's item is already true, say so with the command output.
2. **Then do #5, #9, #10 remainders** (offline industry persistence, Settings editor in both shells, dashboard order, vocabulary consumer-or-delete, unit-conversion parity, the backend tsc error — decide it with `git log -S`/blame whether it is yours).
3. **Then #11 end to end**, in its own execution order, one gap fully done (shared rule → server → migration → engine → hooks → UI → i18n → tests → docs) before the next.
4. After each gap: regenerate `scripts/industry/generate-coverage-table.mjs` data so no row claims more or less than a test proves; `--check` must pass for both generators.
5. Keep a running `docs/architecture/MASTER-EXECUTION-LOG.md`: for each of the 11 prompts, what you verified, what you changed, commands run, real pass/fail/skip counts.

## 4. Completion rule for the whole job

Do not write the final report until every line is true:

- [ ] Each of the 11 prompts has a row in `MASTER-EXECUTION-LOG.md` with evidence, not a claim.
- [ ] Every item the prompts mark open is `VERIFIED_COMPLETE`, or `BLOCKED_EXTERNAL_CREDENTIAL` naming the exact dependency (only: live Supabase SQL, a physical device).
- [ ] Full suites ran to completion, sequentially: validation, local-engine, api, ui, backend, desktop, mobile; eslint on changed files; all guards; both generators `--check`.
- [ ] Web, Windows and Android built; artifact paths and times recorded.
- [ ] The Windows app was driven **offline** through the scenarios in #11 §6 (and the gold / glassware scenarios from #10), with real screenshots, or the exact reason it could not be.
- [ ] Migrations, VERIFY queries and the production release checklist (`docs/PRODUCTION-RELEASE-CHECKLIST-universal-core.md`) exist; ordering is database → backend → clients.
- [ ] Lessons are in `.claude/lessons-learned.md` and `CLAUDE.md`; `.ai/codebase` index rebuilt.
- [ ] `git status` summarised; **nothing committed or pushed**.

## 5. Final report (Persian)

One table, one row per prompt (۱ تا ۱۱) plus a row per gap in #11: وضعیت · فایل‌های تغییرکرده · تست‌ها (اجراشده / قبول / رد / ردشده با عدد واقعی) · مهاجرت (فایل، VERIFY، منتظر اجرای انسان) · آفلاین · باقی‌مانده. Then: suite totals, build paths and times, live-app evidence, the ordered production steps, and every decision you took where a prompt said "ask". The "باقی‌مانده" column is empty only if it really is; never empty it by omission, relabelling or deleting a failing test.

Begin with `git status`, `CLAUDE.md`, then open prompt #1.
