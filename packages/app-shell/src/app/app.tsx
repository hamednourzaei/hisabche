// ============================================
// Routing.
//
// Paths mirror the web app's information architecture exactly — `/invoices`,
// `/quick-invoice`, `/warehouse` and so on. That is not cosmetic: the shared
// screens in `@hisabche/ui/screens` navigate by pushing web-style paths, so
// matching them here lets desktop mount those screens unmodified instead of
// forking a container per platform.
//
// Every feature page is lazily imported so the initial chunk stays small —
// the app must paint in under two seconds on a cold start.
// ============================================

import React, { lazy } from 'react'
import { createHashRouter, Navigate, RouterProvider, useParams } from 'react-router-dom'

import { Providers } from './providers'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth } from '@/features/auth/require-auth'
import { RouteErrorBoundary } from './route-error'
import { LoginPage } from '@/features/auth/login-page'

// ---------- Shared screens (identical module as web renders) ----------
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
// ⚠️ Added after a route audit found these on the web app and NOWHERE else:
// Windows and Android were missing /assistant, /operations and /stock-count
// outright. One UI only means one product if it routes to every page the
// product has. Guard: route-parity.test.ts.
const AssistantPage = lazy(() => import('@/features/ai/assistant-page'))
const OperationsPage = lazy(() => import('@/features/inventory-ops/operations-page'))
const StockCountPage = lazy(() => import('@/features/cycle-count/stock-count-page'))
const InvoicesPage = lazy(() => import('@/features/sales/invoices-page'))
const QuickInvoicePage = lazy(() => import('@/features/sales/quick-invoice-page'))
const InvoiceDetailPage = lazy(() => import('@/features/sales/invoice-detail-page'))
const InvoiceBuilderPage = lazy(() => import('@/features/sales/invoice-builder-page'))
const InvoicePreviewPage = lazy(() => import('@/features/sales/invoice-preview-page'))
const ProductsPage = lazy(() => import('@/features/inventory/products-page'))
const ProductDetailPage = lazy(() => import('@/features/inventory/product-detail-page'))
const CustomersPage = lazy(() => import('@/features/crm/customers-page'))
const CustomerDetailPage = lazy(() => import('@/features/crm/customer-detail-page'))
const AccountingPage = lazy(() => import('@/features/accounting/accounting-page'))
const ActivitiesPage = lazy(() => import('@/features/activity/activities-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))
const SyncCenterPage = lazy(() => import('@/features/sync/sync-page'))
const ApprovalsPage = lazy(() => import('@/features/approvals/approvals-page'))
const DevelopersPage = lazy(() => import('@/features/developers/developers-page'))
const OrdersPage = lazy(() => import('@/features/orders/orders-page'))
const MarketplacePage = lazy(() => import('@/features/marketplace/marketplace-page'))
const BillingPage = lazy(() => import('@/features/billing/billing-page'))
const MarketSellerPage = lazy(() => import('@/features/market/market-seller-page'))
const AnalysisPage = lazy(() => import('@/features/analysis/analysis-page'))
const OnboardingPage = lazy(() => import('@/features/onboarding/onboarding-page'))
const ManufacturingPage = lazy(() => import('@/features/manufacturing/manufacturing-page'))
const TeamAndPayrollPage = lazy(() => import('@/features/team-and-payroll/tap-page'))
const AuditPage = lazy(() => import('@/features/audit/audit-page'))

// Tier 1/2 capabilities. Same containers the web routes mount — desktop owns
// the route, never a second copy of the screen.
const TillPage = lazy(() => import('@/features/finance/till-page'))
const DataAndSyncPage = lazy(() => import('@/features/sync/data-and-sync-page'))
const EmployeeDetailPage = lazy(() => import('@/features/human-resources/employee-detail-page'))
const GovernancePage = lazy(() => import('@/features/permissions/governance-page'))
const PublicTaskPage = lazy(() => import('@/features/public/public-task-page'))
const PublicInvoicePage = lazy(() => import('@/features/public/public-invoice-page'))
const PublicPortalPage = lazy(() => import('@/features/public/public-portal-page'))

/** Carries the invoice id across the `/sales/:id` → `/invoices/:id` rename. */
function LegacyInvoiceRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/invoices/${id}` : '/invoices'} replace />
}

/**
 * G1 — carries the employee id across `/human-resources/:id` →
 * `/team-and-payroll/:id`. Dropping the id and landing on the list would look
 * to the user like the employee record had been deleted.
 */
function LegacyEmployeeRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/team-and-payroll/${id}` : '/team-and-payroll'} replace />
}

// Hash routing: file:// URLs in a packaged app have no server to rewrite paths.
const router = createHashRouter([
  // `errorElement` on both top-level routes covers EVERY screen: react-router
  // walks up from the route that threw to the nearest one, so the entry on `/`
  // catches all of its children — a failed render, a lazy chunk that will not
  // load, or an action that throws. Without it the router's own bare default
  // page appears, with no way back into the app.
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <Navigate to="/" replace /> },

      { path: 'invoices', element: <InvoicesPage /> },
      // Before `:id` — otherwise `new` would be read as an invoice id.
      { path: 'invoices/new', element: <InvoiceBuilderPage /> },
      { path: 'invoices/new/preview', element: <InvoicePreviewPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'quick-invoice', element: <QuickInvoicePage /> },

      { path: 'warehouse', element: <ProductsPage /> },
      { path: 'warehouse/:id', element: <ProductDetailPage /> },

      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },

      { path: 'accounting', element: <AccountingPage /> },
      { path: 'activities', element: <ActivitiesPage /> },
      { path: 'sync-center', element: <SyncCenterPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'developers', element: <DevelopersPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'market-seller', element: <MarketSellerPage /> },
      { path: 'analysis', element: <AnalysisPage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'manufacturing', element: <ManufacturingPage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: 'operations', element: <OperationsPage /> },
      { path: 'stock-count', element: <StockCountPage /> },
      { path: 'team-and-payroll', element: <TeamAndPayrollPage /> },
      { path: 'team-and-payroll/:id', element: <EmployeeDetailPage /> },
      { path: 'audit', element: <AuditPage /> },

      { path: 'till', element: <TillPage /> },
      { path: 'data-and-sync', element: <DataAndSyncPage /> },
      { path: 'governance', element: <GovernancePage /> },

      { path: 'public-task/:token', element: <PublicTaskPage /> },
      { path: 'public-invoice/:token', element: <PublicInvoicePage /> },
      { path: 'portal/:token', element: <PublicPortalPage /> },

      // Legacy desktop paths. Existing windows, deep links and the pinned
      // shortcuts users already have keep working rather than bouncing to the
      // dashboard and losing the record they were opening.
      { path: 'sales', element: <Navigate to="/invoices" replace /> },
      { path: 'sales/new', element: <Navigate to="/quick-invoice" replace /> },
      { path: 'sales/:id', element: <LegacyInvoiceRedirect /> },
      { path: 'inventory', element: <Navigate to="/warehouse" replace /> },
      { path: 'sync', element: <Navigate to="/sync-center" replace /> },

      { path: 'human-resources/:id', element: <LegacyEmployeeRedirect /> },

      // Pages that became a tab or a section of the page holding the same data.
      // The same pairs as the web redirects in next.config.js.
      { path: 'crm', element: <Navigate to="/customers?tab=outreach" replace /> },
      { path: 'sales-followup', element: <Navigate to="/customers?tab=outreach" replace /> },
      { path: 'tasks', element: <Navigate to="/customers?tab=outreach" replace /> },
      {
        path: 'campaigns',
        element: <Navigate to="/customers?tab=outreach&view=campaigns" replace />,
      },
      { path: 'customer-list', element: <Navigate to="/customers" replace /> },
      { path: 'product-list', element: <Navigate to="/warehouse?tab=products" replace /> },
      { path: 'expiry', element: <Navigate to="/warehouse?tab=expiry" replace /> },
      { path: 'human-resources', element: <Navigate to="/team-and-payroll" replace /> },
      {
        path: 'timesheets',
        element: <Navigate to="/team-and-payroll?tab=pay&view=timesheets" replace />,
      },
      { path: 'permissions', element: <Navigate to="/governance?tab=permissions" replace /> },
      { path: 'purchasing', element: <Navigate to="/invoices?type=purchase" replace /> },
      { path: 'promotions', element: <Navigate to="/invoices?tab=pricing" replace /> },
      { path: 'bank', element: <Navigate to="/accounting?tab=treasury" replace /> },
      { path: 'assets', element: <Navigate to="/accounting?tab=treasury&view=assets" replace /> },
      { path: 'budgets', element: <Navigate to="/accounting?tab=reports&view=budgets" replace /> },
      { path: 'workflow-templates', element: <Navigate to="/approvals?tab=workflows" replace /> },
      {
        path: 'conflicts',
        element: <Navigate to="/data-and-sync?tab=details&view=conflicts" replace />,
      },
      {
        path: 'data-migration',
        element: <Navigate to="/data-and-sync?tab=details&view=migration" replace />,
      },
      { path: 'wallet', element: <Navigate to="/billing?tab=money" replace /> },
      { path: 'referrals', element: <Navigate to="/billing?tab=money&view=referrals" replace /> },
      { path: 'accounting-workspace', element: <Navigate to="/accounting" replace /> },
      { path: 'sales-workspace', element: <Navigate to="/invoices" replace /> },
      { path: 'inventory-workspace', element: <Navigate to="/warehouse" replace /> },
      { path: 'people-workspace', element: <Navigate to="/team-and-payroll" replace /> },
      { path: 'workflow', element: <Navigate to="/approvals?tab=workflows" replace /> },

      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
