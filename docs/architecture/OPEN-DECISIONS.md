# Open decisions — pending owner answers

Two product questions are open at this HEAD. Both are recorded here with a stable ID, the code
that would change, and the reversible default the code already runs on.

**`Blocks: none` for both.** Nothing reads this file to decide whether a test may run — the guard
beside it (`packages/validation/src/__tests__/open-decisions.test.ts`) checks that this stays true,
including that no generator under `scripts/` is wired to it. A pending decision is a visible state,
not a queue that stops work.

Companion documents, so this is not a third list of the same thing:

- `docs/architecture/OPEN-QUESTIONS.md` — architecture questions that already have an answer.
- `docs/architecture/V55-OWNER-DECISIONS.md` — the V55 costing decisions, same shape, older scope.
- `docs/MIGRATIONS-PENDING.md` — the 279-migration ledger. Neither row below needs a migration.

---

## 1. The register

| ID   | Decision                                                                                                                                             | Status                 | Measured today | Blocks | Reversible default in force                       | Revisit when                                                                          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------- | ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| D-01 | Business size: the code stores three bands (`small` / `medium` / `large`); V64 §5.1 asks for four headcount bands (`solo` / `2-5` / `6-20` / `more`) | `NEEDS_OWNER_DECISION` | 3 bands        | none   | three bands, unchanged; no migration, no backfill | the owner maps today's rows onto V64's four headcount bands                           |
| D-02 | The 52 hooks `packages/api` exports that no application calls: wire, keep as library surface, or delete                                              | `NEEDS_OWNER_DECISION` | 52 hooks       | none   | kept, unwired, undeleted                          | the owner has reviewed `docs/architecture/universal-core/UNUSED-HOOKS.csv` row by row |

No agent adds a row here for a decision nobody asked for: an invented decision is worse than a
visible open one.

---

## 2. D-01 — business size bands

### What the code does today (read from the files, not remembered)

- `packages/store/src/slices/onboarding.slice.ts:14` — `export type StoreSize = 'small' | 'medium' | 'large'`;
  `setStoreSize` stores the value and advances the wizard to step 3.
- `packages/validation/src/schemas/auth.schema.ts:108` — `storeSize: z.enum(['small', 'medium', 'large']).optional()`.
  A fifth band is refused here, at the route, before anything is written.
- `packages/ui/src/components/ui/onboarding/onboarding-page.tsx:266` — the three cards, labelled by
  `onboarding.smallStore` / `mediumStore` / `largeStore` and their `…Desc` keys.
- `packages/local-engine/src/routes/me.ts:193` — the device shell writes `input.storeSize ?? null`
  through unchanged; it has no list of its own.
- `backend/src/services/profile-write.ts:27` — `store_size` is one of the writable
  `ONBOARDING_COLUMNS`.
- `backend/src/routes/auth.routes.ts:209` and `:893` — the request field is
  `store_size?: string | null` and is written through as sent.

### What is _not_ the blocker

- `docs/onboarding-server-state-migration.sql:27` — `alter table profiles add column if not exists store_size text`.
  Plain `text`, no `CHECK`, so a fifth band already fits the schema as it stands. **No migration is
  required to store one.**
- `packages/validation/src/schemas/operational-dna.ts:1330` — `z.string().max(32)`, which also fits
  `21-50` and `50+`.
- The unit is **settled by V64**: §5.1 says «تعداد نفرات» (headcount), in four bands — alone,
  2–5, 6–20, more. An earlier V65 report described a five-band `21-50 / 50+` scale and called the
  unit unspecified; that was wrong and is corrected here. The open part is the **mapping**, not the
  meaning: `small|medium|large` was written to `profiles.store_size` without a headcount attached,
  so a shop with three staff and one with twenty may share a value. «more» is open-ended on
  purpose; whether it needs a ceiling is part of the answer.

### Options

| Option                                                           | Code change                                                                  | Existing rows                                                             | Risk                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A. Keep three bands, fix the wording only                        | none                                                                         | untouched                                                                 | lowest; the copy stays vague                                                  |
| B. Adopt V64's four headcount bands, map the old three onto them | the files above, one extra card, one i18n key per band in `fa` / `af` / `en` | needs a stated mapping (`small` → `solo` or `2-5` is genuinely ambiguous) | a wrong mapping is not reversible in a report a customer has already read     |
| C. Store three, display four by deriving a band on read          | a derivation next to the reader, no schema change                            | untouched                                                                 | two vocabularies, and the stored value no longer matches what the screen says |

### Recommended default (reversible)

**A.** The three bands stay exactly as they are. Nothing is renamed, deleted or backfilled. If the
owner later picks B, the change is additive: widen the enum in the two type/schema files, add the
one missing card, add its label in three languages, and choose a mapping for the rows that already
exist. Until that mapping is chosen, the current wording is the only vocabulary that has ever been
written to `profiles.store_size`.

### Revisit when

The owner answers one thing: **where today's `small` / `medium` / `large` rows go** on V64's four
headcount bands. The unit itself is no longer open — V64 §5.1 names headcount. The answer is needed
before any code changes; it is not needed for a test run.

---

## 3. D-02 — the 52 hooks with no consumer

### Measured

- **685** exported hooks in `packages/api/src/hooks` (`scripts/api/unused-hooks.mjs`).
- **52** of them are called by no application, package or sibling hook (53 until 13 Nov 2026, when the return dialog's exchange began calling `useExchangeInvoice`). They are the 52 data rows
  of `docs/architecture/universal-core/UNUSED-HOOKS.csv`.
- **36** of the 52 name a request path that matches a registered route, quoted as `file:line`; the
  other 17 name no route that either the Fastify backend or the local engine has.
- Every row's `decision` cell reads `NEEDS_OWNER_DECISION`, and
  `packages/validation/src/__tests__/unused-hooks-ledger.test.ts` fails if the CSV goes stale.

### Why «wire them all» is not the answer

A hook with no consumer is not automatically a missing feature. It is one of three things, and only
the owner can tell which:

1. a capability that has a route and no screen yet — wiring it is a feature, with tests;
2. a leftover of a screen that was deleted — wiring it puts a dead screen in front of customers;
3. a library surface kept for a client that is not in this repository — wiring or deleting it both
   break somebody's build.

The mistake is cheap in the wrong direction: 52 screens is weeks of work and a larger surface to
support, and 53 deletions is irreversible in practice once a customer has used them.

### Options

- **Wire** a row: a real screen on a real route, through the normal capability path — hook, UI,
  three languages, guard test. Cost is per row and is a feature.
- **Keep as library** a row: no screen, no deletion; the ledger row records the reason.
- **Delete** a row: remove the export and its types; cost is one diff, risk is a downstream import
  that this repository cannot see.

These are per-row decisions, not per-file: a module can legitimately hold one of each.

### Recommended default

**Keep, unwired, undeleted.** The CSV is the work list, and an unwired hook costs nothing at
runtime — it is tree-shaken out of every application bundle, since no application imports it.

### Revisit when

The owner has opened the CSV. The guard keeps the row count and the evidence honest in the
meantime, so the list cannot grow silently.

---

## 4. How this file is kept honest

`packages/validation/src/__tests__/open-decisions.test.ts` asserts:

- exactly two rows, `D-01` and `D-02`, in the register table, with the columns the parser reads;
- every `Status` is `NEEDS_OWNER_DECISION` and every `Blocks` cell is `none`;
- every repository path named in this file exists on disk;
- the D-01 measurement equals the enum in `packages/validation/src/schemas/auth.schema.ts`, and the
  `StoreSize` union in `packages/store/src/slices/onboarding.slice.ts` agrees with it — so the
  document cannot claim a band count the code does not have;
- the D-02 measurement equals the data-row count of `UNUSED-HOOKS.csv`, and the row links it;
- no file under `scripts/` and no `package.json` script mentions this file, so a pending decision
  cannot become a gate.

The guard does not run the hook scan; it counts CSV rows. The heavy scan already runs in
`unused-hooks-ledger.test.ts`.

---

## 5. What the owner has to do

- **D-01** — answer «what does a band measure» and «where do the existing rows go». Then it is one
  additive change with no migration.
- **D-02** — open `UNUSED-HOOKS.csv` and write one word per row: `wire`, `library` or `delete`.
  Wiring is a feature and goes through the capability path; `delete` is one diff, not a migration.
- Neither answer is needed to run the suite, to deploy the current tree, or to keep the six
  `--check` generators green.
