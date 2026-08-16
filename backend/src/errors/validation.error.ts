// ============================================
// backend/src/errors/validation.error.ts
//
// A request that parsed fine but broke a business rule — the client sent
// well-formed JSON that the domain refuses. Distinct from Zod's schema
// rejection, which never reaches a service.
// ============================================

import { BaseError } from './base.error'

export class ValidationError extends BaseError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}
