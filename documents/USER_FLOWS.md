# Hisabche — User Flows

## Authentication Flow

### Web

```mermaid
flowchart TD
  A[User opens /[lang]/login] --> B[Enters email + password]
  B --> C[POST /api/auth/login — Zod validated]
  C --> D[Supabase Auth verifies credentials]
  D -- ok --> E[Backend returns session: token + user profile]
  E --> F[Session written to localStorage via auth-core adapter]
  F --> G[Redirect to /[lang]/dashboard]
  D -- fail --> H[401 / error message shown]
  C -- validation fail --> I[Client shows field errors]
```

### Desktop (Electron)

```mermaid
flowchart TD
  A[Renderer login form] --> B[IPC: secure:set (token)]
  B --> C[Main process writes to OS credential store]
  C --> D[Keychain / Credential Manager / encrypted file]
  D --> E[Auth store hydrated from sessionStore]
  E --> F[registerTokenGetter with API client]
  F --> G[Validate session / refresh token]
  G --> H[Open dashboard window]
```

### Mobile

```mermaid
flowchart TD
  A[App launch] --> B[Read session from expo-secure-store]
  B --> C{Valid session?}
  C -- yes --> D[Restore session state]
  D --> E[performSync — push local queue, pull changes]
  E --> F[(tabs) dashboard]
  C -- no --> G[(auth) login screen]
```

## Business Flows

### Create Invoice (sale)

```mermaid
flowchart TD
  A[Pick customer] --> B[Add line items]
  B --> C[Set discount / tax / payment method]
  C --> D[Compute totals: subtotal, tax_total, discount_total, total]
  D --> E{Online?}
  E -- yes --> F[POST /api/invoices → validated → insert invoice + invoice_items]
  E -- no --> G[Write to local DB + mark dirty]
  G --> H[Enqueue create in sync_queue]
  F --> I[Decrement product stock via inventory_movement]
  H --> I
  I --> J[Invoice listed with status]
  J --> K[Optionally run approval workflow_instance]
```

### Edit Invoice

```mermaid
flowchart TD
  A[Open invoice] --> B[Check permission: record.update ≥ member]
  B -- no --> C[403 / hidden controls]
  B -- yes --> D[Edit fields / line items]
  D --> E[Totals recomputed]
  E --> F{Approval instance active?}
  F -- yes --> G[Update requires workflow action — stays pending]
  F -- no --> H[Save; if offline enqueue update]
  H --> I[Stock adjusted for changed quantities]
```

### Inventory Update

```mermaid
flowchart TD
  A[Product / stock event] --> B[Record inventory_movement]
  B --> C[Adjust product.quantity balance]
  C --> D{Below min_stock_level?}
  D -- yes --> E[Low-stock flag / notification]
  E --> F[Sync movement + new quantity]
  D -- no --> F
```

### Customer Creation

```mermaid
flowchart TD
  A[New customer form: full_name, phone, email, address, opening_balance]
  B[Zod validation]
  B -. fail .-> A
  B --> C[POST /api/customer/save → workspaces-scoped]
  C --> D[Customer row + index]
  D --> E[List surfaces in invoice picker + CRM]
```

### Supplier Workflow

```mermaid
flowchart TD
  A[Supplier record] --> B[Raise purchase invoice type=purchase]
  B --> C[Supplier_id on invoice; items increase inventory]
  C --> D[Purchase transactions payable]
  D --> E[Approval workflow if configured entity_type=purchase]
  E --> F[Receive goods → stock in + supplier balance update]
```

### Permission Checking

```mermaid
flowchart TD
  A[User action] --> B[Map action to capability]
  B --> C[{owner, admin, member, viewer} rank]
  C --> D[roleAtLeast(capability) ?]
  D -- ok --> E[Proceed]
  D -- no --> F[403 / hidden UI]
  F --> G[Audit event logged]
```

Capability table (from `@hisabche/auth-core`):

| Capability       | Minimum role |
| ---------------- | ------------ |
| record.read      | viewer       |
| record.create    | member       |
| record.update    | member       |
| record.delete    | owner        |
| member.invite    | admin        |
| workspace.manage | owner        |

### Data Synchronization

```mermaid
flowchart TD
  A[App online] --> C[worker: pull /api/sync/pull since sync_cursor]
  C --> D[Apply changes to local DB + update last_pulled_at]
  D --> E[Push pending sync_queue /api/sync/push]
  E --> F[Retry failures, update status]
  A -- offline --> G[Local writes queue up]
  G --> A

  A[Sync triggered by: connectivity event / manual / on launch]
  style A fill:#f66,stroke:#900
```

Web also exposes realtime sync (Supabase Realtime hooks) so multiple
clients see each other's changes; `sync-center` shows queue/status UI.
