// ============================================
// packages/api/src/lib/api-error-fields.ts
//
// WHICH FIELD the server refused — not just that something was refused.
//
// «هیچ اروری نبود، حتی منم نفهمیدم ارور چی بود»: a 400 named the field all
// along, in one of two shapes, and neither ever reached a form.
//
//   Fastify's schema check:
//     { message: 'body/email must match format "email"' }
//     { message: "body must have required property 'branchId'" }
//   A route that parses the body itself (zod):
//     { details: [ { path: ['body', 'email'], message: 'Invalid email' } ] }
//
// `apiErrorFields` turns either into `[{ field: 'email', message: '…' }]`, so a
// form can put the message on the offending input and send the user there.
// ============================================

export interface ApiFieldError {
  /** The field's name as the API knows it, e.g. `email`, `lines.0.quantity`. */
  field: string
  message: string
}

interface ZodIssueLike {
  path?: Array<string | number>
  message?: string
}

interface ApiErrorBody {
  error?: string
  message?: string
  details?: ZodIssueLike[]
}

/** `['body','lines',0,'quantity']` → `lines.0.quantity`; `['body']` → ''. */
function pathToField(path: Array<string | number> | undefined): string {
  if (!Array.isArray(path)) return ''
  const parts = path.map(String).filter((part) => part.length > 0)
  // The leading 'body' is the request envelope, not something on the form.
  return (parts[0] === 'body' ? parts.slice(1) : parts).join('.')
}

/**
 * Fastify writes the field into the sentence itself. Two forms:
 *   `body/email must match format "email"`
 *   `body must have required property 'branchId'`
 * A nested field arrives slash-separated (`body/lines/0/quantity`).
 */
function fromFastifyMessage(message: string): ApiFieldError | null {
  const required = /must have required property ['"]([^'"]+)['"]/.exec(message)
  if (required?.[1]) return { field: required[1], message }

  const slash = /^body\/(\S+)\s+(.*)$/.exec(message)
  if (slash?.[1]) return { field: slash[1].replace(/\//g, '.'), message: slash[2] || message }

  return null
}

/**
 * Every field the server named, in the order it named them.
 *
 * Returns `[]` when the failure is not about a field — a 500, a network drop,
 * a refusal by business rule. The caller then shows the whole-form message
 * from `apiErrorMessage` instead, rather than blaming an arbitrary input.
 */
export function apiErrorFields(error: unknown): ApiFieldError[] {
  const data = (error as { response?: { data?: ApiErrorBody } })?.response?.data
  if (!data) return []

  if (Array.isArray(data.details)) {
    const fields = data.details
      .map((issue) => ({ field: pathToField(issue.path), message: issue.message ?? '' }))
      .filter((issue) => issue.field.length > 0 && issue.message.length > 0)
    if (fields.length > 0) return fields
  }

  if (typeof data.message === 'string' && data.message.length > 0) {
    const single = fromFastifyMessage(data.message)
    if (single) return [single]
  }

  return []
}
