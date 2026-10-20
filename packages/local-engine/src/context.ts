// ============================================
// packages/local-engine/src/context.ts
//
// Resolves tenancy and identity for offline local engine requests.
// Reads local_workspace and local_user from SQLite.
// ============================================

import type { LocalDb } from './db'
import type { LocalContext } from './types'

export const DEFAULT_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
export const DEFAULT_USER_ID = '22222222-2222-4222-8222-222222222222'
export const DEFAULT_BASE_CURRENCY = 'AFN'
export const DEFAULT_TIME_ZONE = 'Asia/Kabul'

export function resolveContext(
  db: LocalDb,
  headers?: Record<string, string | undefined>,
): LocalContext {
  const explicitWs = headers?.['x-workspace-id']

  const ws = db.get<{
    id: string
    name: string
    base_currency: string
    time_zone: string
  }>('SELECT id, name, base_currency, time_zone FROM local_workspace LIMIT 1')

  const user = db.get<{
    id: string
    full_name: string
    role: string
  }>('SELECT id, full_name, role FROM local_user LIMIT 1')

  const workspaceId = explicitWs || ws?.id || DEFAULT_WORKSPACE_ID
  const userId = user?.id || DEFAULT_USER_ID
  const baseCurrency = ws?.base_currency || DEFAULT_BASE_CURRENCY
  const timeZone = ws?.time_zone || DEFAULT_TIME_ZONE

  return {
    workspaceId,
    userId,
    role: 'owner',
    baseCurrency,
    timeZone,
  }
}
