// ============================================
// backend/src/errors/base.error.ts
// ============================================

export abstract class BaseError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean
  /**
   * Structured facts about a refusal, when the screen needs more than the sentence.
   *
   * A credit-limit refusal is the case that forced this (V53 Phase C): the screen has to show the limit,
   * what the customer already owes and by how much the sale exceeds it. Putting those numbers into the
   * message string made them unreadable for a program and unlocalized for a person; they travel here and
   * are sent as `context` beside the message, never instead of it.
   */
  public readonly context: Record<string, unknown> | undefined

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    context?: Record<string, unknown>,
  ) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    Object.setPrototypeOf(this, new.target.prototype)
    Error.captureStackTrace(this)
  }
}
