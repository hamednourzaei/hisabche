// ============================================
// backend/src/errors/auth.error.ts
// ============================================

import { BaseError } from './base.error'

export class AuthError extends BaseError {
  constructor(message: string) {
    super(message, 401)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends BaseError {
  constructor(message = 'Access denied') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

export class TokenExpiredError extends BaseError {
  constructor(message = 'Token expired') {
    super(message, 401)
    this.name = 'TokenExpiredError'
  }
}