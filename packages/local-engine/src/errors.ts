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

export class OfflineNotAvailableError extends HttpError {
  constructor(feature: string) {
    super(501, 'OFFLINE_NOT_AVAILABLE', 'This feature is not available offline', undefined, feature)
  }
}
