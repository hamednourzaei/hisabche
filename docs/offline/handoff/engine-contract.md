# Local Engine Interface & Transport Contract

> Offline Edition — Phase 4 Specification.
> Defines the boundary between the host platform (Windows Electron main process / Android Expo host) and the embedded business engine (`@hisabche/local-engine`).

---

## 1. Core Principles

1. **In-process Function, NOT an HTTP Server:**
   The engine is an in-memory dispatch function: `request(req: LocalEngineRequest) => Promise<LocalEngineResponse>`.
   No ports are bound, no sockets opened, and no localhost listeners exist.
2. **Identical Route Shapes & Contract:**
   Every request method, path, query parameter structure, body payload, and JSON response shape matches `backend/src/routes/*.ts` byte-for-byte for all fields read by the UI.
3. **Single Transaction for Atomic Writes:**
   Operations modifying multiple tables (e.g. creating an invoice with stock movements, cost layers, ledger posting, and counter increment) execute within a single SQLite transaction (`BEGIN IMMEDIATE ... COMMIT`).
4. **Honest Errors:**
   Every route not implemented in the offline edition returns HTTP 501 with `{ error: 'Feature not available offline', code: 'OFFLINE_NOT_AVAILABLE', feature: '<capability>' }`. Error and empty are strictly distinct branches.
5. **Universal Security & Tenancy:**
   All rows are scoped by `workspace_id`. The local engine reads the active workspace from `local_workspace` (or header `x-workspace-id`) and user from `local_user`. Role is always `owner`.

---

## 2. Database Adapter Interface (`LocalDb`)

The engine does not bind to a specific SQLite library. It accepts an implementation of `LocalDb`:

```typescript
export interface RunResult {
  changes: number
  lastInsertRowid?: number | bigint | undefined
}

export interface LocalDb {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[]
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined
  run(sql: string, params?: unknown[]): RunResult
  exec(sql: string): void
  transaction<T>(fn: () => T): T
}
```

Implementations:

- **Windows (Desktop):** Wraps `better-sqlite3` instance in the Electron main process.
- **Android (Mobile):** Wraps `expo-sqlite` instance in the native host.
- **Tests / In-memory:** Wraps `node:sqlite` (`DatabaseSync`) or in-memory `better-sqlite3`.

---

## 3. Engine Request & Response Types

```typescript
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface LocalEngineRequest {
  method: HttpMethod
  path: string
  params?: Record<string, string | number | boolean | undefined | null> | undefined
  body?: unknown | undefined
  headers?: Record<string, string | undefined> | undefined
}

export interface LocalEngineResponse<T = unknown> {
  status: number
  data: T
  headers?: Record<string, string> | undefined
}
```

---

## 4. Error Responses

All error responses strictly follow the shape expected by `apiErrorMessage()` and `apiErrorFields()`:

```typescript
export interface LocalEngineErrorBody {
  error: string
  code: string
  message?: string | undefined
  details?: Record<string, string[]> | unknown | undefined
  feature?: string | undefined
}
```

HTTP Status Codes:

- `400 Bad Request`: Validation failure (`details` contains field-specific errors).
- `404 Not Found`: Record not found in local database.
- `409 Conflict`: Business rule violation (e.g., period locked, barcode taken, insufficient stock).
- `500 Internal Error`: Unexpected database or execution error.
- `501 Not Implemented`: Feature unavailable offline (`OFFLINE_NOT_AVAILABLE`).

---

## 5. Supported Route Catalog (Phase 4 Core)

| Area       | Route                         | Methods            | Local Behaviour                                                                                                  |
| ---------- | ----------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Products   | `/products`                   | GET, POST          | List, search (name, barcode), filter; create with opening stock & cost layer                                     |
| Products   | `/products/:id`               | GET, PATCH, DELETE | Fetch by ID; update; archive (`is_active = 0`)                                                                   |
| Customers  | `/customers`                  | GET, POST          | List, search; create with opening balance                                                                        |
| Customers  | `/customers/:id`              | GET, PATCH         | Fetch by ID; update                                                                                              |
| Customers  | `/customers/:id/balance`      | GET                | Outstanding balance by currency via shared `partyBalancesByCurrency`                                             |
| Invoices   | `/invoices`                   | GET, POST          | List; atomic create (number counter + invoice + items + stock movements + FIFO/AVCO cost layer + ledger posting) |
| Invoices   | `/invoices/:id`               | GET, DELETE        | Fetch invoice with items; cancel/delete via shared `reverseEffects`                                              |
| Invoices   | `/invoices/:id/cancel`        | POST               | Cancel invoice and reverse stock, costing, and ledger lines                                                      |
| Invoices   | `/invoices/:id/related`       | GET                | Payments and journal entry linked to invoice                                                                     |
| Payments   | `/payments`                   | GET, POST          | List payments; record payment & allocate to open invoices of matching currency                                   |
| Payments   | `/payments/:id/cancel`        | POST               | Cancel payment and reverse ledger & allocations                                                                  |
| Warehouses | `/warehouses`                 | GET, POST          | List active warehouses; create warehouse                                                                         |
| Warehouses | `/warehouses/:id`             | PATCH, DELETE      | Update warehouse; delete (if holding zero stock)                                                                 |
| Warehouses | `/warehouses/placement`       | GET                | Stock levels per warehouse                                                                                       |
| Transfers  | `/stock-transfers`            | POST               | Atomic transfer between warehouses                                                                               |
| Shelves    | `/warehouses/:id/map`         | GET                | Warehouse storage locations & layout                                                                             |
| Shelves    | `/warehouses/:id/locations`   | POST               | Create storage location / shelf                                                                                  |
| Accounting | `/accounting/accounts`        | GET, POST          | List chart of accounts; create account                                                                           |
| Accounting | `/accounting/journal`         | GET, POST          | List journal entries; create entry                                                                               |
| Accounting | `/accounting/trial-balance`   | GET                | Trial balance (`debitBalance` / `creditBalance`) via shared `toTrialBalance`                                     |
| Accounting | `/accounting/profit-report`   | GET                | Profit report via shared `getProfitReport`                                                                       |
| Accounting | `/accounting/period-lock`     | GET, PUT           | Check and set accounting period lock                                                                             |
| Currencies | `/exchange-rates`             | GET, POST          | List exchange rates; record exchange rate                                                                        |
| Settings   | `/settings/base-currency`     | GET, PUT           | Get base currency; set currency (only if books are empty)                                                        |
| Workspace  | `/workspaces`                 | GET                | Return active local workspace                                                                                    |
| Workspace  | `/workspaces/:id`             | GET, PATCH         | Get / update workspace (name, logo, stamp, signature)                                                            |
| Me / Auth  | `/me/capabilities`            | GET                | Returns role `'owner'`, all modules enabled                                                                      |
| Governance | `/governance/my-capabilities` | GET                | Returns role `'owner'`, all capabilities active                                                                  |
| Dashboard  | `/analytics/dashboard`        | GET                | Today sales, customer debt, warehouse stock value                                                                |
| Dashboard  | `/analytics/sales`            | GET                | Sales time-series points                                                                                         |
| Backup     | `/workspaces/backup`          | GET                | Full database dump formatted as JSON, XLSX, or CSV-ZIP                                                           |
| Migrations | `/migrations/inspect`         | POST               | Inspect uploaded CSV, TSV, or XLSX workbook                                                                      |
| Migrations | `/migrations/commit`          | POST               | Import validated customer/product records into local database                                                    |
