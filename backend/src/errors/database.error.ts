// ============================================
// backend/src/errors/database.error.ts
// ============================================

import { BaseError } from './base.error'

export class DatabaseError extends BaseError {
  public readonly originalError?: unknown

  constructor(message: string, originalError?: unknown) {
    super(message, 500)
    this.name = 'DatabaseError'
    this.originalError = originalError
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string) {
    super(`${resource} not found`, 404)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends BaseError {
  constructor(message: string) {
    super(message, 409)
    this.name = 'ConflictError'
  }
}
/**
 * A read that FAILED, as opposed to one that found nothing.
 *
 * `.single()` reports «no row» as error `PGRST116`; that one is a 404. Anything
 * else — a timeout, a missing column, a dropped connection — is a database
 * failure and must not reach the person as «this record does not exist»
 * (lesson 3: error and empty are two branches).
 */
export function isFailedRead(error: { code?: string } | null | undefined): boolean {
  return Boolean(error) && error?.code !== 'PGRST116'
}
