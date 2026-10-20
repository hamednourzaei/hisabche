// ============================================
// packages/local-engine/src/index.ts
//
// The embedded Hisabche Local Business Engine.
// Dispatches in-memory requests to SQLite-backed route handlers.
// ============================================

import { resolveContext } from './context'
import type { LocalDb } from './db'
import { HttpError, OfflineNotAvailableError } from './errors'
import { Router } from './router'
import { registerAccountingRoutes } from './routes/accounting'
import { registerBackupRoutes } from './routes/backup'
import { registerCustomerRoutes } from './routes/customers'
import { registerDashboardRoutes } from './routes/dashboard'
import { registerExchangeRateRoutes } from './routes/exchange-rates'
import { registerImportRoutes } from './routes/import'
import { registerInvoiceRoutes } from './routes/invoices'
import { registerMeRoutes } from './routes/me'
import { registerPaymentRoutes } from './routes/payments'
import { registerProductRoutes } from './routes/products'
import { registerShelfRoutes } from './routes/shelves'
import { registerTransferRoutes } from './routes/transfers'
import { registerWarehouseRoutes } from './routes/warehouses'
import { registerWorkspaceRoutes } from './routes/workspace'
import type {
  LocalContext,
  LocalEngineRequest,
  LocalEngineResponse,
  RouteHandlerContext,
} from './types'

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
  registerWarehouseRoutes(router)
  registerTransferRoutes(router)
  registerShelfRoutes(router)
  registerAccountingRoutes(router)
  registerExchangeRateRoutes(router)
  registerBackupRoutes(router)
  registerWorkspaceRoutes(router)
  registerMeRoutes(router)
  registerDashboardRoutes(router)
  registerImportRoutes(router)

  return {
    async request<T = unknown>(req: LocalEngineRequest): Promise<LocalEngineResponse<T>> {
      try {
        const ctx: LocalContext = resolveContext(db, req.headers)
        const match = router.find(req.method, req.path)

        if (!match) {
          throw new OfflineNotAvailableError(req.path)
        }

        const queryParams = {
          ...match.query,
          ...Object.fromEntries(
            Object.entries(req.params || {}).map(([k, v]) => [k, String(v ?? '')]),
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
