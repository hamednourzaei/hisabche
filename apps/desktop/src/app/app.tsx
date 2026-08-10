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
const PurchasingPage = lazy(() => import('@/features/sales/purchasing-page'))
const ProductsPage = lazy(() => import('@/features/inventory/products-page'))
const ProductDetailPage = lazy(() => import('@/features/inventory/product-detail-page'))
const CustomersPage = lazy(() => import('@/features/crm/customers-page'))
const CustomerDetailPage = lazy(() => import('@/features/crm/customer-detail-page'))
const AccountingPage = lazy(() => import('@/features/accounting/accounting-page'))
const ActivitiesPage = lazy(() => import('@/features/activity/activities-page'))
const SyncPage = lazy(() => import('@/features/sync/sync-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))

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
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'quick-invoice', element: <QuickInvoicePage /> },
      { path: 'purchasing', element: <PurchasingPage /> },

      { path: 'warehouse', element: <ProductsPage /> },
      { path: 'warehouse/:id', element: <ProductDetailPage /> },

      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },

      { path: 'accounting', element: <AccountingPage /> },
      { path: 'activities', element: <ActivitiesPage /> },
      { path: 'sync-center', element: <SyncPage /> },
      { path: 'settings', element: <SettingsPage /> },

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
