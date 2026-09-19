// ============================================
// packages/api/src/lib/api-error-message.ts
//
// One reading of a failed request, for every screen that shows the user why
// their save did not go through.
//
// ⚠️ `response.data.error` IS THE HTTP STATUS NAME, NOT THE REASON.
//
// Fastify refuses a body that fails the route schema with
//   { statusCode: 400, error: 'Bad Request',
//     message: 'body/email must match format "email"' }
// and a route that parses the body itself answers
//   { error: 'Validation failed', details: [ { path, message }, … ] }.
//
// Eight containers read `data.error` alone, so a form with one bad field came
// back as «Bad Request» — or, where the fallback took over, a bare «Error» —
// with nothing saying WHICH field. That is what the owner hit adding an
// employee whose email had no «@».
// ============================================

interface ZodIssueLike {
  path?: Array<string | number>
  message?: string
}

interface ApiErrorBody {
  error?: string
  message?: string
  details?: ZodIssueLike[]
}

/**
 * The most specific sentence the server gave us, falling back outwards:
 * per-field issues → the message → the status name → the thrown Error →
 * the caller's own wording.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: ApiErrorBody } })?.response?.data

  const fromDetails = Array.isArray(data?.details)
    ? data.details
        .map((issue) => {
          // `path` starts at the body root, so the leading 'body' adds nothing.
          const field = issue.path
            ?.filter((part): part is string => typeof part === 'string' && part !== 'body')
            .join('.')
          const text = issue.message ?? ''
          return field ? `${field}: ${text}`.trim() : text
        })
        .filter((line) => line.length > 0)
        .join(' · ')
    : ''

  return fromDetails || data?.message || data?.error || (error as Error)?.message || fallback
}
