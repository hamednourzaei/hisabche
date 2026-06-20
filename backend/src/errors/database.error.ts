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