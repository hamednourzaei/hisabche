# ADR-001: Money Representation & Wire Contract Unification

## Status

Accepted

## Context

Across Hisabche, money amounts have historically suffered from unit fragmentation:

1. **Server Database (Postgres)**: Tables like `invoices`, `invoice_lines`, and `payments` declare money columns as `numeric(12, 2)` holding major currency units (e.g., `'100.50'`).
2. **Device Database (SQLite / local-engine)**: Tables declare money columns as `INTEGER` holding minor currency units in hundredths (e.g., `10050`).
3. **Domain Rules (`packages/validation`)**: Enforce the product invariant: "Money is integer minor units on the money path. No floats." Calculation functions (`computeInvoiceMoney`, `planInstallmentPlan`, `calculatePayroll`) operate strictly on integer hundredths.
4. **Client UI & Wire**: Some endpoints serialize major units (as string or number), while others serialize minor integer hundredths, leading to conversion drift and potential ×100 bugs.

## Comprehensive Money Columns Audit Table

| Entity & Column             | Postgres (Server)        | SQLite (Local Device) | Shared Domain Core           | Client Wire Contract (Target) | UI Layer                              |
| :-------------------------- | :----------------------- | :-------------------- | :--------------------------- | :---------------------------- | :------------------------------------ |
| `invoices.subtotal`         | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `invoices.discount_total`   | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `invoices.tax_total`        | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `invoices.total`            | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `invoice_items.unit_price`  | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Input as major, converted on boundary |
| `invoice_items.total_price` | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `payments.amount`           | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Input as major, converted on boundary |
| `journal_lines.debit`       | `numeric(14, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `journal_lines.credit`      | `numeric(14, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `stock_movements.unit_cost` | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `payrolls.base_salary`      | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |
| `payrolls.net_salary`       | `numeric(12, 2)` (major) | `INTEGER` (minor)     | `Minor` (integer hundredths) | `integer` (minor hundredths)  | Formatted via `@hisabche/formatting`  |

## Decision

1. **Canonical Wire Contract**:
   All new and modernized API wire payloads (`POST /api/sync/push`, local-engine routes, command/event payloads) represent money as **integer minor units** (cents / rials / hundredths) typed as `integer`.
2. **Persistence Boundary Adaptation**:
   - In `backend/src/services/**`: When reading from Postgres `numeric` columns, values are converted to minor units via `toMinorUnits(val) = Math.round(Number(val) * 100)`. When writing to Postgres `numeric`, minor units are serialized via `toMajorUnitsString(minor) = (minor / 100).toFixed(2)`.
   - In `packages/local-engine`: SQLite directly stores `INTEGER` minor units.
3. **Pure Domain Core Rules**:
   - Zero floats.
   - Zero `parseFloat()` or `toFixed()` inside `packages/validation/src/schemas/**`.
   - Pure equality `debits === credits` for ledger balancing.
4. **UI Boundary**:
   - User inputs major amounts (e.g. `10.50`), which are parsed into integer minor units using `@hisabche/formatting` before passing into commands.
   - UI display is handled exclusively by `@hisabche/formatting` (`formatMoney`), supporting Dari (Latin digits) and Persian (Persian digits).

## Consequences

- Property tests and golden vectors are deterministic and free from IEEE 754 float precision errors.
- Both SQLite and Postgres adapters produce identical integer totals when processing identical line items.
- Server-side verification during sync will never diverge due to float rounding.
