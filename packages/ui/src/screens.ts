// ============================================
// Hisabche screens — the shared application surface.
//
// A "screen" is a container: it owns data fetching and navigation intent, then
// renders a presentational view. Web mounts these from its Next.js route
// segments; desktop mounts the same modules from react-router. Neither owns a
// private copy of a screen, so a change to invoicing lands on both renderers at
// once.
//
// Deliberately separate from `index.ts`: that barrel also carries the landing
// site and every primitive, which desktop has no use for. Importing screens
// through their own entry keeps the renderer bundle to the app surface.
//
// Navigation contract: containers push web-style paths (`/invoices/:id`,
// `/quick-invoice`). Desktop's router mirrors those paths exactly — see
// `apps/desktop/src/app/app.tsx` — so no container needs a per-platform branch.
// ============================================

export { DashboardContainer } from './components/ui/dashboard/containers/dashboard-container'

// ---------- Sales & purchasing ----------
export { InvoicesContainer } from './components/ui/invoices/containers/invoices-container'
export { InvoiceDetailContainer } from './components/ui/invoice-detail/containers/invoice-detail-container'
export { QuickInvoiceContainer } from './components/ui/quick-invoice/containers/quick-invoice-container'
export { PurchasingContainer } from './components/ui/purchasing/containers/purchasing-container'

// ---------- Customers ----------
export { CustomersContainer } from './components/ui/customers/containers/customer-container'
export { CustomerDetailContainer } from './components/ui/customers/containers/customer-detail-container'

// ---------- Inventory ----------
export { warehouseContainer as WarehouseContainer } from './components/ui/warehouse/containers/Warehouse-container'
export { ProductDetailContainer } from './components/ui/warehouse-detail/containers/warehouse-detail-container'

// ---------- Accounting & activity ----------
export { AccountingPage } from './components/ui/accounting'
export { ActivitiesPage } from './components/ui/activity/ActivitiesPage'

// ---------- Sync ----------
export { SyncCenterContainer } from './components/ui/sync-center/containers/sync-center-container'

// ---------- Settings ----------
// The stamp/signature uploader only. Desktop keeps its own settings shell for
// the Electron-specific parts (app version, local database) and mounts this for
// the product-wide setting, rather than growing a second uploader.
export { BusinessStampSection } from './components/ui/settings'
