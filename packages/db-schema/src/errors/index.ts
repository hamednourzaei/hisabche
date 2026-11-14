// packages/db-server/src/errors/index.ts
export class DatabaseError extends Error {
  public originalError?: unknown
  public statusCode: number

  constructor(message: string, originalError?: unknown) {
    super(message)
    this.name = 'DatabaseError'
    this.originalError = originalError
    this.statusCode = 500
  }
}
