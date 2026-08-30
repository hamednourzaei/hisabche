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
import { LoginPage } from '@/features/auth/login-page'

// ---------- Shared screens (identical module as web renders) ----------
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const InvoicesPage = lazy(() => import('@/features/sales/invoices-page'))
const QuickInvoicePage = lazy(() => import('@/features/sales/quick-invoice-page'))
const InvoiceDetailPage = lazy(() => import('@/features/sales/invoice-detail-page'))
const InvoiceBuilderPage = lazy(() => import('@/features/sales/invoice-builder-page'))
const InvoicePreviewPage = lazy(() => import('@/features/sales/invoice-preview-page'))
const PurchasingPage = lazy(() => import('@/features/sales/purchasing-page'))
const ProductsPage = lazy(() => import('@/features/inventory/products-page'))
const ProductDetailPage = lazy(() => import('@/features/inventory/product-detail-page'))
const CustomersPage = lazy(() => import('@/features/crm/customers-page'))
const CustomerDetailPage = lazy(() => import('@/features/crm/customer-detail-page'))
const AccountingPage = lazy(() => import('@/features/accounting/accounting-page'))
const ActivitiesPage = lazy(() => import('@/features/activity/activities-page'))
const CrmPage = lazy(() => import('@/features/crm/crm-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))
const SyncCenterPage = lazy(() => import('@/features/sync/sync-page'))
const ApprovalsPage = lazy(() => import('@/features/approvals/approvals-page'))
const BillingPage = lazy(() => import('@/features/billing/billing-page'))
const OnboardingPage = lazy(() => import('@/features/onboarding/onboarding-page'))
const ManufacturingPage = lazy(() => import('@/features/manufacturing/manufacturing-page'))
const PermissionsPage = lazy(() => import('@/features/permissions/permissions-page'))
const HumanResourcesPage = lazy(() => import('@/features/human-resources/hr-page'))
const TeamAndPayrollPage = lazy(() => import('@/features/team-and-payroll/tap-page'))
const WorkflowPage = lazy(() => import('@/features/workflow/workflow-page'))
const SalesFollowupPage = lazy(() => import('@/features/sales-followup/sales-followup-page'))
const AuditPage = lazy(() => import('@/features/audit/audit-page'))

// Tier 1/2 capabilities. Same containers the web routes mount — desktop owns
// the route, never a second copy of the screen.
const TillPage = lazy(() => import('@/features/finance/till-page'))
const AssetsPage = lazy(() => import('@/features/finance/assets-page'))
const BankPage = lazy(() => import('@/features/finance/bank-page'))
const BudgetsPage = lazy(() => import('@/features/finance/budgets-page'))
const TimesheetsPage = lazy(() => import('@/features/operations/timesheets-page'))
const ExpiryPage = lazy(() => import('@/features/operations/expiry-page'))
const ConflictsPage = lazy(() => import('@/features/sync/conflicts-page'))
const GovernancePage = lazy(() => import('@/features/permissions/governance-page'))
const PublicTaskPage = lazy(() => import('@/features/public/public-task-page'))
const PublicInvoicePage = lazy(() => import('@/features/public/public-invoice-page'))

/** Carries the invoice id across the `/sales/:id` → `/invoices/:id` rename. */
function LegacyInvoiceRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={id ? `/invoices/${id}` : '/invoices'} replace />
}

// Hash routing: file:// URLs in a packaged app have no server to rewrite paths.
const router = createHashRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'dashboard', element: <Navigate to="/" replace /> },

      { path: 'invoices', element: <InvoicesPage /> },
      // Before `:id` — otherwise `new` would be read as an invoice id.
      { path: 'invoices/new', element: <InvoiceBuilderPage /> },
      { path: 'invoices/new/preview', element: <InvoicePreviewPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'quick-invoice', element: <QuickInvoicePage /> },
      { path: 'purchasing', element: <PurchasingPage /> },

      { path: 'warehouse', element: <ProductsPage /> },
      { path: 'warehouse/:id', element: <ProductDetailPage /> },

      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },

      { path: 'accounting', element: <AccountingPage /> },
      { path: 'activities', element: <ActivitiesPage /> },
      { path: 'crm', element: <CrmPage /> },
      { path: 'sync-center', element: <SyncCenterPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'billing', element: <BillingPage /> },
      { path: 'onboarding', element: <OnboardingPage /> },
      { path: 'manufacturing', element: <ManufacturingPage /> },
      { path: 'permissions', element: <PermissionsPage /> },
      { path: 'human-resources', element: <HumanResourcesPage /> },
      { path: 'team-and-payroll', element: <TeamAndPayrollPage /> },
      { path: 'workflow', element: <WorkflowPage /> },
      { path: 'sales-followup', element: <SalesFollowupPage /> },
      { path: 'audit', element: <AuditPage /> },

      // Paths mirror the web routes exactly, so no container needs a
      // per-platform branch — see NAV_CONTRACT for the same six paths.
      { path: 'till', element: <TillPage /> },
      { path: 'assets', element: <AssetsPage /> },
      { path: 'bank', element: <BankPage /> },
      { path: 'budgets', element: <BudgetsPage /> },
      { path: 'timesheets', element: <TimesheetsPage /> },
      { path: 'expiry', element: <ExpiryPage /> },
      { path: 'conflicts', element: <ConflictsPage /> },
      { path: 'governance', element: <GovernancePage /> },

      // Web serves this at `/workflow-templates` and desktop only had
      // `/workflow`. The contract names one path, so desktop answers to it —
      // the old path stays as a redirect below rather than breaking a shortcut.
      { path: 'workflow-templates', element: <WorkflowPage /> },
      { path: 'public-task/:token', element: <PublicTaskPage /> },
      { path: 'public-invoice/:token', element: <PublicInvoicePage /> },

      // Legacy desktop paths. Existing windows, deep links and the pinned
      // shortcuts users already have keep working rather than bouncing to the
      // dashboard and losing the record they were opening.
      { path: 'sales', element: <Navigate to="/invoices" replace /> },
      { path: 'sales/new', element: <Navigate to="/quick-invoice" replace /> },
      { path: 'sales/:id', element: <LegacyInvoiceRedirect /> },
      { path: 'inventory', element: <Navigate to="/warehouse" replace /> },
      { path: 'sync', element: <Navigate to="/sync-center" replace /> },

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
