# Always-Local — continuous run F2 → F3 → F4 (no stopping between phases)

> Read `docs/offline/ALWAYS-LOCAL-PROMPT.en.md` (rules, principles, tests) and `docs/offline/ALWAYS-LOCAL-00-FINDING.md` first. Everything there still applies, **except** the "stop after each step" rule, which this file replaces.

F0 and F1 are approved and done. Now run **F2, F3 and F4 back to back in one session**, then do the final verification and builds once. **Do not stop to ask, do not report between phases.** Each phase still has to prove itself (tests green + injection-tested) before you begin the next. Do that check yourself, write one line in the running log, and carry on.

---

## 1. The owner has already made every decision below. Do not ask again.

| Question                                       | Decision                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products read from the device like customers?  | **Yes, first task of F2.** Same `readRows` path, real `offset` + real `total` (fix the "total = page length" behaviour).                                                                                                                                                                                                                                                                 |
| Customer search on device = name only?         | **Yes**, it has to match the server (`ilike full_name`). Also make the local-engine route match the server. One rule, two hosts.                                                                                                                                                                                                                                                         |
| Freshness label on device-read lists?          | **No label.** Background pull + realtime are enough. The sync center shows "last sync".                                                                                                                                                                                                                                                                                                  |
| Operational window                             | Constant `OPERATIONAL_WINDOW_DAYS = 90`, plus every open invoice and open balance regardless of age.                                                                                                                                                                                                                                                                                     |
| The 10 local tables nobody fills               | Fill the ones the operational set needs (stock per warehouse, payments, warehouses, branches, employees, book currency, exchange rates, invoice lines). Fill them through the **existing** `sync_change_log` pull if Phase 0 showed it covers them. Otherwise extend that same pull, never a second mechanism. Any table that stays empty is listed in the final report with the reason. |
| Device invoice counter                         | In F3 it becomes the temporary id `OFF-<device>-<seq>`, labelled "temporary" on screen and in print (fa/af/en). The official number comes only from the server's `nextval('invoice_number_seq')` at commit.                                                                                                                                                                              |
| Conflict states                                | Extend the existing M2.4 conflict queue with `PENDING_REVIEW → ACCEPTED / REJECTED / RESOLVED`. Reject = keep the record plus reason, decider and time, and reverse via `reverseEffects` if it was posted. Never delete.                                                                                                                                                                 |
| fa-AF inheritance in desktop-strings           | Keep the existing inheritance pattern. Override only where the Dari wording differs (`.claude/DARI-GLOSSARY.md`).                                                                                                                                                                                                                                                                        |
| Server migration needed (e.g. conflict states) | Write it as `docs/*-migration.sql` + VERIFY + a pg test run twice. **Do not wait** for the human to run it. Make the code tolerate the column/table being absent (`isMissingSchema` → "not configured", never a 500) and continue.                                                                                                                                                       |

## 2. When something is unclear

Do **not** stop. Pick the option that:

1. reuses an existing primitive (Principle 1);
2. never loses or guesses financial data;
3. keeps the server as final authority.

Record the choice in `docs/offline/ALWAYS-LOCAL-DECISIONS.md` (question → choice → why → file:line) and continue. The owner reviews that file at the end.

## 3. The only reasons you may stop early

- A test you cannot make green without weakening it, or without breaking a rule in §0 of the main prompt.
- Something would need DDL on the live database, a secret, or a real device to proceed **and** there is no code-side way to continue.
- An existing system blocks the phase (`BLOCKED_BY_EXISTING_SYSTEM`).

In any of those cases, finish every other part you can, then report. A scope that "feels big" is **not** a reason to stop. Split it into smaller verified steps inside the same run.

## 4. Running log

Keep `docs/offline/ALWAYS-LOCAL-RUN-LOG.md` updated as you go. Write one line per finished step:

`F2.1 products device-read · tests 12 new · injection red ✓ · tsc 0`

This is your proof trail. It replaces reporting to the owner between phases.

## 5. Order inside the run

```
F2.1 products device-read (offset + real total)
F2.2 local-engine customer search = server rule
F2.3 operational dataset pull for the missing tables (existing change-log)
F2.4 staged bootstrap + progress on the existing sync indicator
F2.5 "not available offline" for data outside the window
F3.1 one SQLite transaction for an offline invoice (lines, stock, balance, KPI projection, outbox)
F3.2 shared domain core only + the one-financial-engine guard
F3.3 temporary id OFF-<device>-<seq> + "temporary" label; official number from the server
F3.4 KPI = synced + labelled pending; equal to the server after a full sync
F4.1 conflict states on the existing queue (+ migration files, schema-tolerant code)
F4.2 owner decision: accept / reject / resolve, role from request.tenancy.role on the server
F4.3 seller sees state + reason; reject keeps history, reverses if posted
F4.4 two-device test (stock 5, 3+3): deterministic, consistent with M2.4
```

## 6. End of the run (only once, after F4.4)

The full verification from the main prompt §6: tsc in every package, then backend vitest, ui vitest, desktop jest, mobile jest. Run the suites **one after another, not in parallel**. Then:

- eslint on the changed files;
- the Windows build (probe `RESULT=LOADED`);
- the Android build (check the APK timestamp);
- lessons into `.claude/lessons-learned.md` from 218, with the count in `CLAUDE.md`;
- `graphify.exe . --update`.

**One final report in Persian.** It covers:

- what each phase did;
- the real numbers;
- the run log;
- the decisions file;
- the migrations waiting for the human, each with `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`;
- the device checklist;
- exactly one status.

No commit, no push.
