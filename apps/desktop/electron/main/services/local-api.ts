// ============================================
// apps/desktop/electron/main/services/local-api.ts
//
// In-process Local Engine service for desktop (Electron).
// Runs business logic dispatch directly against the active SQLite database.
// ============================================

import {
  createLocalEngine,
  type LocalEngine,
  type LocalEngineRequest,
  type LocalEngineResponse,
} from '@hisabche/local-engine'
import { getLocalDb } from '../db/database'

let engine: LocalEngine | null = null

function getEngine(): LocalEngine {
  if (!engine) {
    engine = createLocalEngine(getLocalDb())
  }
  return engine
}

export async function handleLocalApiRequest<T = unknown>(
  req: LocalEngineRequest,
): Promise<LocalEngineResponse<T>> {
  return getEngine().request<T>(req)
}
