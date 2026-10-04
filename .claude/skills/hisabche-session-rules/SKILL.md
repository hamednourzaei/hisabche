---
name: hisabche-session-rules
description: How the owner wants work done in this repository — what never to do without asking, the order of work, and the shape of the final report. Read at the start of every session and before ending a turn.
---

# How to work here

These are standing instructions from the owner (Hamed), gathered over many
sessions. They are not preferences to weigh; breaking one has, each time, cost
a correction and some trust.

## Never, without being asked

| Rule                                                                                | Why                                       |
| ----------------------------------------------------------------------------------- | ----------------------------------------- |
| **No `git commit`, no `git push`.** The owner commits and pushes.                   | «دیگه هیچچیزیو بدون اجازه من کامیت نکن»   |
| **No subagents.** Do the work yourself.                                             | «No agents — do it yourself»              |
| **No build until ALL the work is finished.**                                        | Stopped twice mid-work for building early |
| **No DDL on the live database.** Write the migration + VERIFY; the owner runs them. | CLAUDE.md §0                              |
| **Do not read `.env`.** Never print or enter a credential.                          |                                           |
| **No antivirus exclusions**, no security-setting changes.                           |                                           |
| **Do not ask «which phase next?»** Do all of them, in priority order.               | «خودت تمام ۱۲ فاز انجام بده»              |

## The order of work — always this one

1. Read `.claude/USER-REQUESTS.md` and the relevant session cache.
2. Inventory what already exists (`grep` for the engine, the table, the hook).
   Most «new» capabilities here already have a domain file nobody calls.
3. Build every capability end to end — backend, web, Windows, mobile and the
   Supabase script **together** (see `hisabche-feature-delivery`).
4. Full verify: `tsc` and tests in every package.
5. `eslint` on every changed file, from that package's own folder. Zero errors.
6. Builds — site, Windows, Android — only now (see `hisabche-release-build`).
7. Lessons into `.claude/` and `CLAUDE.md`; open items into `USER-REQUESTS.md`.
8. The final report.

Do not stop between steps to check in. Stop only when something is truly the
owner's decision, or blocked on a credential.

## Talking to the owner

- **Reply in Persian.** Code, comments, commit-free notes in `.claude/skills`
  may be English; `.claude/*.md` session notes are Persian.
- Short progress notes while working are welcome. Questions are not, unless the
  answer changes what you do next.
- When the owner pastes VERIFY output, read every row: `ok: false` is a bug in
  the migration, not in their database.

## The final report

A table per capability, then real numbers. Use only these statuses:

`VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` ·
`BLOCKED_EXTERNAL_CREDENTIAL` · `BLOCKED_BY_EXISTING_SYSTEM` ·
`NOT_APPLICABLE` · `FAILED`

- `VERIFIED_COMPLETE` needs real HTTP or the real database, seen in this
  session. Green tests are `IMPLEMENTED_NOT_LIVE_VERIFIED`.
- Anything that needs a key nobody gave you is `BLOCKED_EXTERNAL_CREDENTIAL`,
  with the exact list of what is needed.
- For a migration: `Post-migration verification query generated — PENDING
HUMAN CONFIRMATION`. Never «PASS» before the owner reports the result.
- End with «کارهای سمت شما»: the scripts to run **in order**, the env vars to
  set, the decisions that are theirs.
- Say plainly what was NOT built and why. Say what you saw and did not touch.

## Product rules the owner has stated

- No fake data, no mock API, no invented numbers — real data or an explicit
  empty state that says why it is empty.
- Every money entry form offers a **currency** selector, and a quantity its
  **unit**, like the invoice builder.
- A claim on the landing page, FAQ or docs must exist in code.
- Performance is a hard gate (PSI 99/100 must not regress).
- A new capability goes on the existing core — find the model, component or
  store that exists and extend it. Never a second one beside it.
- Keep Expo SDK 51 / RN 0.74. No upgrade, no New Architecture.
