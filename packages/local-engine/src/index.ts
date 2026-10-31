// ============================================
// packages/local-engine/src/index.ts
//
// The embedded Hisabche Local Business Engine.
// Dispatches in-memory requests to SQLite-backed route handlers.
// ============================================

import { endpointAvailability, isUnsetValue } from '@hisabche/validation'
import { resolveContext } from './context'
import type { LocalDb } from './db'
import { HttpError, OfflineNotAvailableError } from './errors'
import { Router } from './router'
import { registerAccountingRoutes } from './routes/accounting'
import { registerAnalysisRoutes } from './routes/analysis'
import { registerAttendanceRoutes } from './routes/attendance'
import { registerBackupRoutes } from './routes/backup'
import { registerBranchRoutes } from './routes/branches'
import { registerBudgetRoutes } from './routes/budgets'
import { registerCostingRoutes } from './routes/costing'
import { registerCustomerRoutes } from './routes/customers'
import { registerDashboardRoutes } from './routes/dashboard'
import { registerEmployeeRoutes } from './routes/employees'
import { registerExchangeRateRoutes } from './routes/exchange-rates'
import { registerFeedRoutes } from './routes/feed'
import { registerImportRoutes } from './routes/import'
import { registerInsightRoutes } from './routes/insights'
import { registerInstallmentRoutes } from './routes/installments'
import { registerInvoiceRoutes } from './routes/invoices'
import { registerMeRoutes } from './routes/me'
import { registerPartyStatementRoutes, registerPaymentRoutes } from './routes/payments'
import { registerPayrollRoutes } from './routes/payroll'
import { registerPricingRoutes } from './routes/pricing'
import { registerProductRoutes } from './routes/products'
import { registerPurchasingRoutes } from './routes/purchasing'
import { registerReportRoutes } from './routes/reports'
import { registerShelfRoutes } from './routes/shelves'
import { registerStockInsightRoutes } from './routes/stock-insights'
import { registerTillRoutes } from './routes/till'
import { registerTransferRoutes } from './routes/transfers'
import { registerUnitRoutes } from './routes/units'
import { registerVariantsRoutes } from './routes/variants'
import { registerMetalRatesRoutes } from './routes/metal-rates'
import { registerFitmentsRoutes } from './routes/fitments'
import { registerWarrantiesRoutes } from './routes/warranties'
import { registerOrderDepositsRoutes } from './routes/order-deposits'
import { registerTaxRoutes } from './routes/tax'
import { registerWarehouseRoutes } from './routes/warehouses'
import { registerWorkspaceRoutes } from './routes/workspace'
import type {
  LocalContext,
  LocalEngineRequest,
  LocalEngineResponse,
  RouteHandlerContext,
} from './types'

export * from './auth'
export * from './context'
export * from './db'
export * from './errors'
export * from './export'
export * from './router'
export * from './types'

export interface LocalEngine {
  request<T = unknown>(req: LocalEngineRequest): Promise<LocalEngineResponse<T>>
}

export function createLocalEngine(db: LocalDb): LocalEngine {
  const router = new Router()

  // Register all offline domain modules
  registerProductRoutes(router)
  registerCustomerRoutes(router)
  registerInvoiceRoutes(router)
  registerPaymentRoutes(router)
  registerPartyStatementRoutes(router)
  registerWarehouseRoutes(router)
  registerTransferRoutes(router)
  registerShelfRoutes(router)
  registerAccountingRoutes(router)
  registerReportRoutes(router)
  registerCostingRoutes(router)
  registerAnalysisRoutes(router)
  registerPurchasingRoutes(router)
  registerStockInsightRoutes(router)
  registerExchangeRateRoutes(router)
  registerBackupRoutes(router)
  registerWorkspaceRoutes(router)
  registerMeRoutes(router)
  registerDashboardRoutes(router)
  registerFeedRoutes(router)
  registerBranchRoutes(router)
  registerImportRoutes(router)
  registerInsightRoutes(router)
  registerUnitRoutes(router)
  registerEmployeeRoutes(router)
  registerPayrollRoutes(router)
  registerAttendanceRoutes(router)
  registerBudgetRoutes(router)
  registerInstallmentRoutes(router)
  registerPricingRoutes(router)
  registerTillRoutes(router)
  registerVariantsRoutes(router)
  registerMetalRatesRoutes(router)
  registerFitmentsRoutes(router)
  registerWarrantiesRoutes(router)
  registerOrderDepositsRoutes(router)
  registerTaxRoutes(router)

  return {
    async request<T = unknown>(req: LocalEngineRequest): Promise<LocalEngineResponse<T>> {
      try {
        const ctx: LocalContext = resolveContext(db, req.headers)
        const match = router.find(req.method, req.path)

        if (!match) {
          // The matrix says WHICH feature and whether the device can ever run it.
          const verdict = endpointAvailability(req.method, req.path)
          throw new OfflineNotAvailableError(
            verdict?.feature ?? req.path,
            verdict?.status === 'not_supported' ? 'not_supported' : 'online_required',
          )
        }

        const queryParams = {
          ...match.query,
          // ⚠️ A FILTER NOBODY SET IS ABSENT, NOT AN EMPTY STRING (26 Oct 2026).
          // The shared list hooks send `{ isActive: undefined, lowStock: undefined,
          // … }`. `String(undefined ?? '')` made each of them `''`, and every
          // route's «was it asked for?» test is `query.x !== undefined`: `''`
          // passed it, `'' === 'true'` is false, so `isActive` became «only
          // INACTIVE products» and the invoice picker listed none of them with
          // 10 grams of gold in stock. An unset value is dropped here, once, for
          // every route.
          ...Object.fromEntries(
            Object.entries(req.params || {})
              .filter(([, v]) => !isUnsetValue(v))
              .map(([k, v]) => [k, String(v)]),
          ),
        }

        const handlerContext: RouteHandlerContext = {
          db,
          ctx,
          params: match.params,
          query: queryParams,
          body: req.body,
          headers: req.headers || {},
        }

        const result = await match.handler(handlerContext)

        // Check if handler explicitly specified a status code
        if (
          result !== null &&
          typeof result === 'object' &&
          '__status' in result &&
          '__data' in result
        ) {
          const custom = result as { __status: number; __data: unknown }
          return {
            status: custom.__status,
            data: custom.__data as T,
          }
        }

        // Standard REST status: 201 for resource creation POSTs, 200 otherwise
        let status = 200
        if (req.method === 'POST') {
          const isAction =
            req.path.includes('/cancel') ||
            req.path.includes('/reverse') ||
            req.path.includes('/inspect') ||
            req.path.includes('/place')
          status = isAction ? 200 : 201
        }

        return {
          status,
          data: result as T,
        }
      } catch (err) {
        if (err instanceof HttpError) {
          return {
            status: err.status,
            data: err.toJSON() as unknown as T,
          }
        }

        const message = err instanceof Error ? err.message : String(err)
        return {
          status: 500,
          data: {
            error: message,
            code: 'INTERNAL_ERROR',
          } as unknown as T,
        }
      }
    },
  }
}
