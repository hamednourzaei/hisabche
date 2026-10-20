// ============================================
// packages/local-engine/src/types.ts
// ============================================

import type { LocalDb } from './db'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface LocalEngineRequest {
  method: HttpMethod
  path: string
  params?: Record<string, string | number | boolean | undefined | null> | undefined
  body?: unknown | undefined
  headers?: Record<string, string | undefined> | undefined
}

export interface LocalEngineResponse<T = unknown> {
  status: number
  data: T
  headers?: Record<string, string> | undefined
}

export interface LocalContext {
  workspaceId: string
  userId: string
  role: 'owner'
  baseCurrency: string
  timeZone: string
}

export interface RouteHandlerContext {
  db: LocalDb
  ctx: LocalContext
  params: Record<string, string>
  query: Record<string, string>
  body: unknown
  headers: Record<string, string | undefined>
}

export type RouteHandler = (context: RouteHandlerContext) => Promise<unknown> | unknown
