# Feature Matrix

| Feature | Code location | Web route | Mobile location | Desktop location | API route | DB tables | Unit | Component/UI | Integration | API/Contract | E2E | Security | Data | Offline | Runtime verified? | Known bugs | Known gaps | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Invoices | `services/invoice/` | `/invoices` | `SalesScreen` | `InvoiceView` | `/api/invoices` | `invoices`, `invoice_lines` | Y | Y | Y | Y | N | Y | Y | Y | YES | 0 | E2E missing | READY |
| Accounting | `services/accounting/` | `/accounting` | N/A | `LedgerView` | `/api/accounting` | `journal_entries` | Y | N | Y | Y | N | Y | Y | Y | YES | 0 | UI test missing | READY |
| Inventory | `services/warehouse/` | `/inventory` | `StockScreen` | `StockView` | `/api/inventory` | `stock_movements` | Y | Y | Y | Y | N | Y | Y | Y | YES | 0 | - | READY |
| Customers | `services/crm/` | `/customers` | `CrmScreen` | `CrmView` | `/api/customers` | `customers` | Y | Y | Y | Y | N | Y | Y | Y | YES | 0 | - | READY |
