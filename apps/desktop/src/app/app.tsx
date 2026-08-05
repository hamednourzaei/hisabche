// ============================================
// Routing.
//
// Every feature page is lazily imported so the initial chunk stays small —
// the app must paint in under two seconds on a cold start.
// ============================================

import React, { lazy } from 'react'
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom'

import { Providers } from './providers'
import { AppShell } from '@/components/layout/app-shell'
import { RequireAuth } from '@/features/auth/require-auth'
import { LoginPage } from '@/features/auth/login-page'

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'))
const InvoicesPage = lazy(() => import('@/features/sales/invoices-page'))
const NewInvoicePage = lazy(() => import('@/features/sales/new-invoice-page'))
const InvoiceDetailPage = lazy(() => import('@/features/sales/invoice-detail-page'))
const ProductsPage = lazy(() => import('@/features/inventory/products-page'))
const CustomersPage = lazy(() => import('@/features/crm/customers-page'))
const CustomerDetailPage = lazy(() => import('@/features/crm/customer-detail-page'))
const AccountingPage = lazy(() => import('@/features/accounting/accounting-page'))
const SyncPage = lazy(() => import('@/features/sync/sync-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))

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
      { path: 'sales', element: <InvoicesPage /> },
      { path: 'sales/new', element: <NewInvoicePage /> },
      { path: 'sales/:id', element: <InvoiceDetailPage /> },
      { path: 'inventory', element: <ProductsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/:id', element: <CustomerDetailPage /> },
      { path: 'accounting', element: <AccountingPage /> },
      { path: 'sync', element: <SyncPage /> },
      { path: 'settings', element: <SettingsPage /> },
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
