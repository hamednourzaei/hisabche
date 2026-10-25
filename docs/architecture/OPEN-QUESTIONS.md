# Architecture Open Questions & Unknowns

This document records architectural decisions, assumptions, and known unknowns encountered during the Local-First Shared Domain Core implementation.

---

## 1. Money Representation & Legacy Major-Unit Migration (ADR-001)

- **Question:** How do we handle existing Postgres tables where some money columns (e.g. `invoices.total`) are `numeric` in major currency units, while SQLite tables store integer hundredths, and the domain core enforces minor integers?
- **Decision:** As decided in ADR-001, the wire and domain contract is strictly **integer minor units** (e.g. 100 hundredths = 1.00 USD/IRR/AFN). Server database adapters convert to/from legacy `numeric` columns at the persistence boundary. No float or major-unit math is permitted inside pure business logic.

---

## 2. Document Number Allocation for Offline Devices

- **Question:** How should offline devices issue sequential, collision-free invoice and receipt numbers when disconnected from the central Postgres sequence (`nextval`)?
- **Decision:** A block-reservation strategy is used. When connected, the client requests a block of pre-allocated document numbers (e.g. block of 50 or 100 numbers `[1000..1099]`) tied to its `device_id`. When offline, it issues strictly from this allocated range. If the block is exhausted while offline, it flags new documents with a provisional identifier (`PROVISIONAL-<device_id>-<seq>`), which is reconciled upon sync.

---

## 3. Offline Entries into Closed Accounting Periods

- **Question:** If an offline device records an invoice or return during a period that has since been closed or locked on the server, what is the authoritative resolution?
- **Decision:** The server cannot alter historical locked ledger entries (which would break closed tax periods and audited financial statements). In accordance with accounting domain standards, the server posts the transaction's financial effect into the earliest _open_ period, while preserving the document's original transaction date as an informational/effective date, and marks the journal entry with `PERIOD_REALLOCATED`.

---

## 4. Local Database Encryption on Linux & Unsupported Environments

- **Question:** Windows Electron uses DPAPI via `safeStorage`, and Android uses Android Keystore. How should desktop Linux or unsupported developer environments handle local database key storage?
- **Decision:** Electron's `safeStorage.isEncryptionAvailable()` guards the OS vault. If unavailable (e.g. headless Linux or development CI), it falls back to an obfuscated local keyfile with a warning log, preserving functionality while avoiding fatal startup crashes in test environments.

---

## 5. (25 Oct 2026) Raised by the gate-review corrections — see ADR-005

1. **`POST /auth/validate` has no server route.** The client calls it and the matrix carries a
   row for it, but `backend/src/routes` registers nothing at that path. Either the client call is
   dead, or a route was never registered. **Unknown which.** Recorded in the CSV as
   `server@none`; not removed, because removing it would hide the mismatch.
2. **205 of 462 endpoints are `unproven`, not cloud-only.** They are the honest localisation
   backlog. The prompt's rule («everything else must justify why it is not local») is now
   measurable: any row that moves to `SERVER_ONLY` must first gain a `reason@file:line`.
3. **Shadow verification currently covers one capability** (`payment.record`, on
   `POST /api/payments`). The obvious second candidate is `POST /api/invoices`, where
   `InvoiceService` already derives through `computeInvoiceMoney` — a shadow check there would
   compare the stored row against that same derivation. **Not built this session**; it needs a
   decision about whether a second check earns its cost, per the prompt's «measure first».
4. **`round2` silently maps non-finite input to `0`** (`packages/validation/src/schemas/money.ts`
   line 46). That is a defensible choice for a display helper, but it means a `NaN` amount
   becomes a spotless zero posting rather than an error. The shadow check now guards its own
   inputs; **whether the core itself should refuse a non-finite amount is an open product
   question** and was NOT changed here (it would alter every caller).
5. **`value`, `effort`, `risk` columns were dropped from the CSV.** They were hand-set
   heuristics (`med`/`high`) with no basis in code, so the requirement was to derive or drop
   them; they were dropped and `registry_intent` (the feature registry's declared
   `execution: local|server|hybrid`) took their place. If a prioritisation column is wanted back,
   it needs a stated metric, not a guess.
6. **The backend vitest suite cannot run in this sandbox** (`spawn EPERM` at config load,
   pre-existing for every test). `core-shadow.test.ts` and `core-divergence.pg.test.ts` are
   type-checked and were executed through equivalent harnesses in `.agent-notes/`; they have not
   been observed green **inside** the backend runner. Status:
   `IMPLEMENTED_NOT_LIVE_VERIFIED` for those two files.

---

## 6. (25 Oct 2026, final round) � ADR-007

1. **The alarm is OFF everywhere by default.** `workspaces.divergence_alarm_percent`
   is NULL, which means �not configured�. Somebody must choose a threshold per
   workspace before any notification is sent. **Open product question:** what
   value? This ADR deliberately does not guess � the right number depends on how
   noisy the first weeks of shadow mode turn out to be.
2. **Which money path gets shadow verification next?** Costing (FIFO/AVCO) and
   payroll are both shared-core rules with two readers. Neither is wired because
   each needs a defined �same facts� moment between server and engine; guessing
   it would flag every backdated sale. **Needs its own ADR.**
3. **Persistence was not measured.** No Supabase credentials on this machine, so
   every load number covers the server around the data, not the data. Filling the
   remaining cells needs a seeded database.
4. **The packaged binaries were not run.** The corpus is green under Jest on both
   Electron and React Native runtimes; that is not the same as running the built
   `.exe`/`.apk`.
5. **227 rows remain `unproven`.** That is the honest backlog, not a verdict. Any
   row that moves to `SERVER_ONLY` needs a `reason@file:line` first.
