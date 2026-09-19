// Request #101 — «Error» was all the owner got for a form with one bad field.
//
// Adding an employee whose email had no «@» returned Fastify's
// `{ statusCode: 400, error: 'Bad Request', message: 'body/email must match
// format "email"' }`. The container read `data.error`, so the screen said
// «Bad Request» and named no field. A refused save must say what to fix.
import { describe, expect, it } from 'vitest'

import { apiErrorMessage } from '../lib/api-error-message'

const axiosError = (data: unknown, message = 'Request failed with status code 400') =>
  Object.assign(new Error(message), { response: { data } })

describe('apiErrorMessage', () => {
  it('prefers the sentence that names the field over the status name', () => {
    const error = axiosError({
      statusCode: 400,
      error: 'Bad Request',
      message: 'body/email must match format "email"',
    })
    expect(apiErrorMessage(error, 'fallback')).toBe('body/email must match format "email"')
  })

  it('lists every field a zod refusal names', () => {
    const error = axiosError({
      error: 'Validation failed',
      details: [
        { path: ['body', 'email'], message: 'Invalid email' },
        { path: ['body', 'branchId'], message: 'Required' },
      ],
    })
    expect(apiErrorMessage(error, 'fallback')).toBe('email: Invalid email · branchId: Required')
  })

  it('drops the leading «body», which tells the reader nothing', () => {
    const error = axiosError({ details: [{ path: ['body', 'salary'], message: 'Too small' }] })
    expect(apiErrorMessage(error, 'fallback')).toBe('salary: Too small')
  })

  it('still shows the status name when that is all there is', () => {
    expect(apiErrorMessage(axiosError({ error: 'Forbidden' }), 'fallback')).toBe('Forbidden')
  })

  it('falls back to the thrown error, then to the caller’s wording', () => {
    expect(apiErrorMessage(new Error('Network Error'), 'fallback')).toBe('Network Error')
    expect(apiErrorMessage({}, 'ذخیره ناموفق بود')).toBe('ذخیره ناموفق بود')
    expect(apiErrorMessage(undefined, 'ذخیره ناموفق بود')).toBe('ذخیره ناموفق بود')
  })

  it('never returns an empty string — an empty message is a blank alert box', () => {
    // axios's own `error.message` still counts as something the caller can
    // show, so these pass an error with nothing of its own to say.
    expect(apiErrorMessage(axiosError({ message: '' }, ''), 'fallback')).toBe('fallback')
    expect(apiErrorMessage(axiosError({ details: [] }, ''), 'fallback')).toBe('fallback')
    expect(apiErrorMessage(axiosError({ details: [{ message: '' }] }, ''), 'fallback')).toBe(
      'fallback',
    )
  })

  it('survives a details field that is not an array', () => {
    // A proxy or gateway can put anything in the body; a crash here would
    // replace the real failure with a render error.
    expect(apiErrorMessage(axiosError({ details: 'nope', message: 'real reason' }), 'f')).toBe(
      'real reason',
    )
  })
})
