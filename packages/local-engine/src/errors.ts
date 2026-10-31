// ============================================
// packages/local-engine/src/errors.ts
//
// Structured errors returning the same { error, code, message }
// shape and HTTP status codes as the backend, so apiErrorMessage()
// and apiErrorFields() work unchanged in the UI.
// ============================================

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
    public readonly feature?: string,
  ) {
    super(message ?? code)
    this.name = 'HttpError'
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
      ...(this.feature !== undefined ? { feature: this.feature } : {}),
    }
  }
}

export class NotFoundError extends HttpError {
  constructor(entity: string, id?: string) {
    super(404, 'NOT_FOUND', id ? `${entity} ${id} not found` : `${entity} not found`)
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown, code?: string) {
    const isCode = !code && /^[A-Z0-9_]+$/.test(message)
    const errCode = code || (isCode ? message : 'VALIDATION_ERROR')
    super(400, errCode, message, details)
  }
}

export class ConflictError extends HttpError {
  constructor(code: string, message?: string) {
    super(409, code, message ?? code)
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', code = 'CAPABILITY_REQUIRED', details?: unknown) {
    super(403, code, message, details)
    this.name = 'ForbiddenError'
  }
}

export class OfflineNotAvailableError extends HttpError {
  /**
   * @param feature the feature the endpoint belongs to (the endpoint matrix), or
   *   the path when the matrix does not know it
   * @param availability `online_required` or `not_supported` — the screen words
   *   the notice from it
   */
  constructor(
    feature: string,
    availability: 'online_required' | 'not_supported' = 'online_required',
  ) {
    super(
      501,
      'OFFLINE_NOT_AVAILABLE',
      'This feature is not available offline',
      { availability },
      feature,
    )
  }
}
