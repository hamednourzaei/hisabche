# N-17 — the sales-return service queries `invoice_lines`

Date: 2026-10-26. Static trace; the Postgres tests could not run (GATE-04). Nothing changed.

## Verdict

**`CONFIRMED_P0`.** `invoice_lines` is not defined anywhere in the repository. The real table is `invoice_items`, and even with the right name the service reads columns that table does not have. Every cloud return request throws and answers HTTP 500.

## 1. Trace

| Step           | Evidence                                                                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route          | `backend/src/routes/invoice-return.routes.ts:29-60` `POST /api/invoices/:id/returns`, `invoice.create` capability; passes `workspaceId`, `returnType`, `returnNumber`, `returnDate`, `lines[{originalLineId, returnQuantity, restockChoice, reasonCode}]`; **no `originalLines`**; no try/catch |
| Service        | `backend/src/services/sales/invoice-return.service.ts:36-60`: when `originalLines` is empty it runs `this.db.from('invoice_lines').select('*').eq('invoice_id', input.originalInvoiceId)` and maps the rows                                                                                     |
| Error handling | `const { data: invLines } = …` — the `error` is **not read**; a missing table gives `data = null`, so `originalLines = []`                                                                                                                                                                      |
| Domain call    | `calculateReturnDocument(…, [], requestedLines)` → `returns.domain.ts:84`: `throw new Error('Original line … not found in invoice …')`                                                                                                                                                          |
| HTTP result    | `backend/src/index.ts:520-538` global error handler: an `Error` without `statusCode` → **500**, body contains the message and the request path                                                                                                                                                  |

## 2. Is `invoice_lines` a table, view, alias, old artefact or typo?

| Where searched                                                                               | Result                                                                                           |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `docs/*.sql` (330 files, `CREATE TABLE/VIEW/MATERIALIZED VIEW`, 303 names parsed)            | not defined                                                                                      |
| `scripts/audit/table-names.mjs` over every `.from()` in `backend/src`                        | `invoice_lines` is the only undefined name in changed code                                       |
| whole repository text search outside `node_modules`, `.git`, `graphify-out` and `docs/audit` | only `invoice-return.service.ts`                                                                 |
| local SQLite schema (`packages/app-bridge/src/local-schema.ts`)                              | table is `invoice_item`; the engine twin `local-engine/src/routes/invoice-returns.ts` reads that |
| adapters / name translation                                                                  | none found (`db` is the plain supabase client; `grep` for table-name maps finds none)            |
| tests                                                                                        | no test references `invoice_lines` or exercises `InvoiceReturnService` through a route           |

So: not a view, not test-only, not translated. It is a wrong name.

## 3. The real table does not match the service's column guesses

`invoice_items` (`docs/SETUP-COMPLETE.sql:399-414`): `id, invoice_id, product_id, product_name, quantity numeric(12,3), unit_price numeric(12,2), discount numeric(5,2), total_price numeric(12,2), created_at, user_id, notes, unit, weight_grams, unit_label` (later migrations may add columns such as `workspace_id`; not re-read).

The service reads `unit_price_minor || unit_price`, `subtotal_minor || total`, `total_minor || total`, `product_id`, `quantity`, and hard-codes `discountMinor: 0`, `taxMinor: 0`:

- `unit_price_minor`, `subtotal_minor`, `total_minor`, `total` do not exist; `total_price` is never read, so subtotal and total would be `0`;
- `unit_price` and `total_price` are **major** units with two decimals, while the domain works in **minor** units — the `|| unit_price` fallback would store a major amount in a field named minor;
- `discount` is a **percentage** (`numeric(5,2)`), not an amount;
- the query has no workspace filter (the table's base definition has no `workspace_id` column), so the invoice's ownership is never checked.

Fixing only the table name would therefore still produce a zero-value, tax-free, unscoped return.

## 3a. Production consequence

`POST /api/invoices/:id/returns` always fails on the cloud edition (HTTP 500 `Original line … not found`). Nothing is written (the failure precedes both inserts), so no data is corrupted. The offline edition's twin writes the records to SQLite and nothing else (N-01). The UI button «ثبت و برگشت به انبار» therefore either errors (cloud) or records a document with no effect (offline).

## 4. Why nothing caught it

No TypeScript type for server tables (no generated Supabase types; `packages/db-schema` is the offline Drizzle schema); the `error` of the query is not checked; no route or Postgres test touches the service; the pure domain tests pass arrays directly.

## 5. Status of related claims

N-01 (no effect on stock, ledger, money): `CONFIRMED`. N-02 parts: see `UNIVERSAL-CORE-GAP-LEDGER.md` §A.
