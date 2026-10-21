# Always-Local + Server Sync — Phase 0 finding (MEASURE ONLY)

> Phase 0 of `docs/offline/ALWAYS-LOCAL-PROMPT.en.md`. **No code was changed to
> produce this document** — every number and every `file:line` below was read.
> Scope: the Windows and Android shells (app-shell) only; the web app is not
> touched.
>
> The question this file answers: **why does an offline customer not load in
> the invoice builder, while the product beside it does?**

---

## 1. The two paths, side by side

### 1.1 The product path — the device answers

```
invoice-builder/grid/description-cell.tsx:32,127     useProducts({…})
  └─ packages/api/src/hooks/products.ts:131          useProducts()
       ├─ :137  useRealtime({ table: 'products' … })
       ├─ :171  const device = getOfflineQueue()
       ├─ :172-176  fromDevice()  → device.readRows('product', search)
       ├─ :177  if (device?.readRows && device.isOffline()) return fromDevice()
       ├─ :179  apiClient.get('/products')            ← only when online
       ├─ :184-185  on NETWORK_ERROR → fromDevice()
       └─ :195  networkMode: 'always'                  ← React Query must not pause it offline
```

and the barcode path (the scanner / the keyboard wedge):

```
packages/api/src/hooks/products.ts:76   lookupProductByBarcode()
  ├─ :81   const device = getOfflineQueue()
  ├─ :83-92  device.findByBarcode(barcode)  → the device's SQLite FIRST
  ├─ :94   if (device?.isOffline()) return { status: 'error', offline: true }
  └─ :96-109  only then the server
```

The device read itself:

```
packages/api/src/lib/offline-queue.ts:28   readRows?(table: 'product' | 'customer', search)
packages/api/src/lib/offline-queue.ts:34   findByBarcode?(barcode)
   └─ registered by the shell: packages/app-shell/src/app/providers.tsx:56-60
        readRows: (table, search) => device.db.query({ table, search, limit: 500 })
   └─ the bridge: packages/app-bridge/src/contract.ts (db.query) → the desktop
      (apps/desktop/electron/main/db/database.ts) / Android (expo-sqlite)
   └─ the local table: packages/app-bridge/src/local-schema.ts:19 (product)
```

### 1.2 The customer path — the API answers, and only the API

```
invoice-builder/customer-panel.tsx:28,181     <CustomerPicker …/>
  └─ packages/ui/src/components/ui/customer-picker.tsx:57   useCustomers()
       └─ packages/api/src/hooks/customers.ts:42-73
            ├─ :45  useAuthReady()
            ├─ :50  useRealtime({ table: 'customers' … })
            ├─ :57  apiClient.get('/customers', { params: filters, signal })
            ├─ :65  asList<Customer>(data?.customers, '/customers')
            └─ :69-72  enabled: authReady · staleTime 60s · placeholderData: previousData
```

### 1.3 Where the two paths diverge — exactly

|                                       | Product                                                                      | Customer                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| A device read exists in the API layer | **yes** — `offline-queue.ts:28` `readRows` accepts `'product' \| 'customer'` | the same interface already accepts `'customer'` — **the plumbing exists** |
| The hook uses it                      | **yes** — `products.ts:172-177`                                              | **no** — `customers.ts:56-68` has no device branch at all                 |
| `networkMode: 'always'`               | **yes** — `products.ts:195`                                                  | **no**                                                                    |
| Offline behaviour                     | the device's `product` table answers                                         | the request is attempted, fails, and the picker shows nothing             |

**So the answer to "why don't customers load offline" is not a missing
primitive — it is one hook that never asks.** The device read for `customer`
is already declared (`offline-queue.ts:28`), already registered by the shell
(`providers.tsx:56-60`), and already proven for products
(`products.ts:172-177`). The customer hook simply does not use it.

The same divergence appears in the code's own comments: `products.ts:168-170`
records the identical bug for products («this list used to render "no
products" — the network error shown as an empty stock — while the device
database held every product») and `products.ts:191-195` records the second
half of it (React Query PAUSES an offline query, so the device branch was
never reached at all). Both were fixed for products; neither was applied to
customers.

**One more read that cannot work offline:** the oversell check
(`invoice-builder/use-oversold-lines.ts:76` → `useProductsByIds`,
`products.ts:383`) has **no** device branch either — the stock number a
decision is based on is API-only today.

---

## 2. The entity table

**Device tables: 26** (`packages/app-bridge/src/local-schema.ts` + the v3
migration `packages/app-bridge/src/local-migrations.ts`).

| Entity                   | Local table                                                        | Filled by                                          | The UI reads it from                                                                     |
| ------------------------ | ------------------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| customer                 | ✅ `customer` (local-schema.ts:46)                                 | the sync (delta + snapshot)                        | **API** — `useCustomers` (customers.ts:57). _The device table is filled but never read._ |
| product                  | ✅ `product` (:19)                                                 | the sync                                           | **SQLite** (offline) / API (online) — `useProducts` (products.ts:172-185)                |
| stock per warehouse      | ✅ `product_stock` (:235)                                          | the local engine (its own moves)                   | API (`/warehouses/placement`) — not read from the device                                 |
| invoice                  | ✅ `invoice` (:70)                                                 | the sync (delta + snapshot)                        | API (`useInvoices`) — the device copy is not read                                        |
| invoice line             | ✅ `invoice_item` (:104)                                           | the sync (`storeInvoiceItems`, sync-engine.ts:236) | API                                                                                      |
| payment                  | ✅ `payment` (:327)                                                | the local engine only                              | API                                                                                      |
| payment allocation       | ✅ `payment_allocation` (:351)                                     | the local engine only                              | API                                                                                      |
| accounts / journal       | ✅ `account` (:367), `journal_entry` (:385), `journal_line` (:405) | the local engine only                              | API                                                                                      |
| employee                 | ✅ `employee` (:171)                                               | **nobody**                                         | API                                                                                      |
| warehouse                | ✅ `warehouse` (:220)                                              | the local engine only                              | API                                                                                      |
| branch                   | ✅ `branch` (:249)                                                 | **nobody**                                         | API                                                                                      |
| shelf                    | ✅ `shelf` (:264)                                                  | the local engine only                              | API                                                                                      |
| book currency            | ✅ `local_workspace.base_currency` (:199)                          | the local engine / the first run                   | API (`useBaseCurrency`)                                                                  |
| exchange rate            | ✅ `exchange_rate` (:424)                                          | the local engine only                              | API (`useExchangeRates`)                                                                 |
| cost layer / consumption | ✅ `cost_layer` (:283), `cost_consumption` (:304)                  | the local engine only                              | API                                                                                      |
| product stock movement   | ✅ `inventory_movement` (:153)                                     | the local engine only                              | API                                                                                      |
| transaction (POS)        | ✅ `transaction` (:131)                                            | the local engine only                              | API                                                                                      |
| outbox                   | ✅ `sync_queue` (:447)                                             | the shell (the queued writes)                      | —                                                                                        |
| cursor / meta            | ✅ `sync_cursor` (:459), `meta` (:464)                             | the sync engine                                    | —                                                                                        |

Two more facts that belong in this table:

- **The persisted query cache is bypassed offline**:
  `packages/api/src/lib/persisted-query-cache.ts:67,99-100` — in the offline
  edition the local SQLite is the single source of truth, so the cache is not
  persisted. So the "third read path" in the online world (localStorage) does
  not exist offline at all — which is why the product path had to be built on
  the device explicitly.
- **`sync_queue` has no `workspace_id`** (local-schema.ts:447-455: `client_id`,
  `entity`, `operation`, `payload`, `attempts`, `status`, `last_error`,
  `created_at`). The outbox is **not** workspace-scoped in the device schema —
  see §6.

---

## 3. The existing sync — what it covers today

### 3.1 The mechanism (it exists, and it is the canonical one)

| Piece                                    | Where                                                                                                                                                                      | What                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| the change log                           | `backend/src/services/sync.service.ts:613,648-672` — table **`sync_change_log`**, columns `sync_version, entity_type, entity_id, operation, entity_version, origin_device` | a **monotonic cursor**; the client asks for everything `> cursor`                                                       |
| the pull endpoint                        | `sync-engine.ts:382-399` → `GET /sync/pull?cursor&limit` (limit 500, max 200 pages)                                                                                        | a bounded, resumable walk                                                                                               |
| the snapshot (rebuild)                   | `sync-engine.ts:288-325` → `GET /sync/snapshot` (keyset, 500/page, 1000 pages max)                                                                                         | a full rebuild when there is no cursor                                                                                  |
| the horizon                              | `sync.service.ts:724-740` `isBehindHorizon`                                                                                                                                | a cursor older than the oldest surviving log row → `mustRehydrate` → the device re-snapshots (`sync-engine.ts:398-399`) |
| the mutation queue (outbox, server side) | `sync.service.ts:377,408-449` — table **`sync_mutations`**                                                                                                                 | the server's own outbox                                                                                                 |
| the client's outbox                      | the device's `sync_queue` + `packages/api/src/lib/offline-queue.ts`                                                                                                        | one entity only: `invoice/create` (`packages/api/src/hooks/invoices.ts:190-200`)                                        |

### 3.2 What the sync covers — **three entities**

`packages/app-shell/src/features/sync/sync-engine.ts:75`

```ts
const DELTA_ENTITIES = ['customer', 'product', 'invoice'] as const
```

So of the 13 entities in §2, the sync brings **customer, product, invoice**
(and the invoice's lines, `storeInvoiceItems`, sync-engine.ts:236). The other
ten (payment, journal, account, employee, warehouse, branch, shelf, cost
layer, exchange rate, product_stock) are **never pulled** — the local engine
writes some of them itself when it creates a document, and the rest stay
empty.

### 3.3 How deletes are propagated

`sync-engine.ts:329-379` (`applyChanges`):

- a change with `operation === 'delete'` **or** a `data: null` = "the row is
  gone" (`:350-353`);
- for `customer` and `product` the row is **retired, not erased**:
  `is_active = 0` (`:354-365`, with the rule at `:78` `RETIRED_NOT_REMOVED`) —
  because a queued local change may still reference it;
- for `invoice` the row is **removed** — but only if this device holds no
  unsent edit to it (`db.removeMany` → the desktop refuses to remove a row
  with `dirty = 1`, `apps/desktop/electron/main/db/database.ts`
  `removeMany`, contract `db:removeMany`);
- the invoice's lines are removed with it (`removeInvoiceItems`,
  sync-engine.ts:270-286).

### 3.4 Not covered (from the §2 table)

payments · payment allocations · journal entries/lines · accounts · employees ·
warehouses · branches · shelves · cost layers/consumptions · exchange rates ·
product stock · the POS transaction table. Plus: **the outbox carries only
`invoice/create`** — a customer, a product, a payment or a stock move made
offline has **no** path to the server today.

---

## 4. Which financial functions are pure, and which are bound to Supabase

### 4.1 Pure (the shared core — `packages/validation`, no I/O)

| File                                                        | What it decides                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/validation/src/schemas/money.ts`                  | `minor`, `round2`, `roundHalfAwayFromZero`, `sumRounded`          |
| `packages/validation/src/schemas/invoice-math.ts`           | `computeItemTotalRounded`, `roundInvoiceMoney`, `sumInvoiceLines` |
| `packages/validation/src/schemas/stock.ts`                  | the stock movement rule                                           |
| `packages/validation/src/schemas/costing.domain.ts`         | FIFO/AVCO, `planConsumption`, `coverSoldUnits`                    |
| `packages/validation/src/schemas/accounting.domain.ts`      | the ledger's structure                                            |
| `packages/validation/src/schemas/profit-report.domain.ts`   | `buildProfitReport`, `costStatus` (unknown ≠ 0)                   |
| `packages/validation/src/schemas/invoice-posting.domain.ts` | `invoiceLedgerLines`, `inBooksCurrency`                           |
| `packages/validation/src/schemas/payments.domain.ts`        | `partyBalancesByCurrency`, `paymentPosting`, `settlesInCurrency`  |

### 4.2 Bound to Supabase (server only — the right place for them)

`backend/src/services/**` — `invoice.service.ts` (persistence, authorization,
official numbering), `product.service.ts`, `analytics.service.ts`,
`entitlement.service.ts`, `plan-limits.service.ts`, `billing.service.ts`,
`sync.service.ts`. They own the storage, the permissions, the final
validation and the official numbers.

### 4.3 The local engine already imports the shared core — §1's guard has a green base

`packages/local-engine/src/routes/*` import from `@hisabche/validation`:
`invoices.ts:22`, `accounting.ts:23`, `payments.ts:17`, `customers.ts:16`,
`products.ts:10`, `warehouses.ts:7`, `transfers.ts:9`, `shelves.ts:9`,
`exchange-rates.ts:8`, `workspace.ts:7`, `backup.ts`, `me.ts`, `dashboard.ts`.

The money rules are therefore **already one implementation**: the local engine
calls `computeItemTotal` / `roundInvoiceMoney` / `planConsumption` /
`invoiceLedgerLines` / `buildProfitReport` / `partyBalancesByCurrency` /
`paymentPosting` — the same functions the server calls. **No second formula
exists under app-shell or local-engine.** The §1 guard can be written against
this base without extracting anything.

---

## 5. Invoice numbering — where it comes from today

### 5.1 The server (canonical)

```
backend/src/services/invoice.service.ts:981   const invoiceNumber = await this.generateInvoiceNumber()
backend/src/services/invoice.service.ts:3435-3437   private async generateInvoiceNumber() {
                                                    const { data, error } = await supabase.rpc('get_next_invoice_number')
```

and the function itself (`docs/missing-rpcs-migration.sql:35-42`):

```sql
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION get_next_invoice_number()
RETURNS bigint
LANGUAGE sql
VOLATILE
AS $$
  SELECT nextval('invoice_number_seq');
$$;
```

**One global sequence** — not per branch, not per fiscal period, not per
workspace; the number is a `bigint` from `nextval`. The migration's own
comment records why: `SELECT max(n)+1` under two concurrent sales returns the
same number twice; a sequence is atomic and leaves a gap on a rollback, and
gaps are fine while duplicates are two invoices with one identity.

### 5.2 The device (today)

```
packages/app-bridge/src/local-schema.ts:211   CREATE TABLE invoice_counter (…)
packages/local-engine/src/routes/invoices.ts:429,439   the next number from invoice_counter (SELECT, then INSERT)
```

The device has its **own** counter — a second numbering system, exactly what
the prompt forbids. The temporary number is produced by the local engine's
`invoice_counter` and is **not** marked as temporary anywhere in the UI.

---

## 6. What logout does today when the outbox is not empty

```
packages/app-shell/src/features/auth/auth.store.ts:467-488   logout()
  ├─ apiClient.post('/auth/logout', { token })
  ├─ sessionStore.clear()                     ← the session only
  └─ set({ session: null, isAuthenticated: false, … })
```

**The outbox is never looked at.** The consequence, measured from the code:

- `sync_queue` has **no `workspace_id`** (local-schema.ts:447-455) and the
  logout does not clear it, so the pending rows **survive** the logout
  (nothing is silently destroyed ✓) — and they are then pushed by **whoever
  signs in next** (`sync-engine.ts:460-545` `pushEntry`, the workspace comes
  from the _active_ workspace at that moment). A second user on the same
  device can therefore send the first user's queued invoice.
- The **local data also survives** the logout: no `db.removeMany` /
  `dbRemoveMany` call exists on the sign-out path (the bridge's
  `db:removeMany` — `packages/app-bridge/src/contract.ts:21` — is used by the
  sync engine's invoice-delete path only). The next user on the device sees
  the previous user's cached customers, products and invoices in the device
  tables.
- The web's store has the same shape (`packages/store/src/slices/auth.slice.ts:376`).

**So: nothing is destroyed (good) and nothing is scoped or cleared (bad).**
There is no "pending changes" dialog anywhere, and no count of pending
changes is shown before the sign-out.

---

## 7. Size — the local DB for a workspace with 100,000 invoices

### 7.1 The formula

```
DB ≈ N × ( row_invoice + L̄·row_item + row_movement + row_cost_layer
            + row_journal_entry + L̄·row_journal_line )
     × (1 + index_overhead) × page_factor
```

### 7.2 The inputs, from the actual column lists

| Input                                    | Value             | Where it comes from                                                                                                                                            |
| ---------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `N`                                      | 100,000 invoices  | the scenario                                                                                                                                                   |
| `L̄` (lines per invoice)                  | **3**             | an assumption — stated, not measured                                                                                                                           |
| `row_invoice`                            | **≈ 400 B**       | 28 columns (local-schema.ts:70-98): 3 uuids (36 B each) + a customer name + a date + 5 integers + a note + 3 timestamps ≈ 386 B of payload + the record header |
| `row_item`                               | **≈ 370 B**       | 21 columns (local-schema.ts:104-126): 4 uuids + a product name + a note + 3 timestamps ≈ 360 B                                                                 |
| `row_movement`                           | ≈ 250 B           | `inventory_movement` (:153)                                                                                                                                    |
| `row_cost_layer`                         | ≈ 200 B           | `cost_layer` (:283)                                                                                                                                            |
| `row_journal_entry` / `row_journal_line` | ≈ 200 B / ≈ 220 B | `journal_entry` (:385) / `journal_line` (:405)                                                                                                                 |
| `index_overhead`                         | **35 %**          | an estimate for the primary keys plus the 4 indexes on the invoice/item/movement tables (local-schema.ts:100-169); the schema has 24 indexes in total          |
| `page_factor`                            | **1.1**           | SQLite's 4 KB pages are ~90 % full                                                                                                                             |

### 7.3 The arithmetic

```
per invoice = 400 + 3×370 + 250 + 200 + 200 + 3×220
            = 400 + 1110 + 250 + 200 + 200 + 660
            = 2,820 B
× 1.35 (indexes)  = 3,807 B
× 1.1  (pages)    = 4,188 B  ≈ 4.1 KB per invoice
× 100,000          = 419 MB  ≈ 0.4 GB
```

**≈ 0.4 GB for the whole workspace** — before a single byte of the
attachments, the images, the audit trail or the WAL. A phone cannot hold
that, and the desktop's `hisabche.db` would double in size on every
workspace it visits.

The **operational subset** (F2) is what makes it survivable: active
customers and products, the stock of the accessible warehouses, the open
invoices + the last N days (default 90), the open balances, the active
employees, the book currency and the rates. If the open + recent window is
10 % of the invoices, the local DB is **≈ 40 MB** — and the invoice that is
older than the window is _not_ on the device, which is why the prompt's
«data outside the set ⇒ an explicit "not available offline" message, never an
empty list» matters.

---

## 8. What this finding says about the next step (F1)

The prompt's F1 is «read customers through the same path products use». The
measurement says that path is **already there**:

- `offline-queue.ts:28` — `readRows` already accepts `'customer'`;
- `providers.tsx:56-60` — the shell already registers a generic device read;
- `products.ts:172-177` — the pattern to copy is 6 lines.

So F1 is **one hook** (`useCustomers`, `packages/api/src/hooks/customers.ts:56-68`),
not a new subsystem — with the two details the product hook records:
`networkMode: 'always'` (products.ts:195) and the `NETWORK_ERROR` fallback
(products.ts:184-185).

Three findings that must travel with F1 (they are not F1's job, but F1 will
expose them):

1. **The outbox is not workspace-scoped** (§6) — the queued rows survive a
   sign-out and are pushed by the next user. The prompt's §4 (logout with
   unsynced changes) is a **separate** fix, and it needs the queue to carry a
   workspace (or a user) before it can be made safe.
2. **The device has its own invoice counter** (§5.2) — the local number is a
   second numbering system. F3 must replace it with the server's canonical
   number plus a clearly labelled temporary id.
3. **Ten entities have a local table that nothing ever fills** (§3.4) — the
   device is not a mirror of the workspace yet; it is a mirror of three
   tables. F2 decides which of the ten the operational set actually needs.

---

_Measured on 20 Oct 2026. No code was changed for this document._
