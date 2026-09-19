// Request #102 — «هر فیلد در هر جای پروژه مشکل داشت، کاربر را ببر به اون بخش».
//
// The server has always named the field; nothing read it. These are the two
// shapes it arrives in, plus the cases where blaming a field would be a lie.
import { describe, expect, it } from 'vitest'

import { apiErrorFields } from '../lib/api-error-fields'

const axiosError = (data: unknown) =>
  Object.assign(new Error('Request failed with status code 400'), { response: { data } })

describe('apiErrorFields', () => {
  it('reads a Fastify format failure', () => {
    const fields = apiErrorFields(axiosError({ message: 'body/email must match format "email"' }))
    expect(fields).toEqual([{ field: 'email', message: 'must match format "email"' }])
  })

  it('reads a missing required property', () => {
    const fields = apiErrorFields(
      axiosError({ message: "body must have required property 'branchId'" }),
    )
    expect(fields[0]?.field).toBe('branchId')
  })

  it('reads every zod issue, in order', () => {
    const fields = apiErrorFields(
      axiosError({
        error: 'Validation failed',
        details: [
          { path: ['body', 'email'], message: 'Invalid email' },
          { path: ['body', 'salary'], message: 'Expected number' },
        ],
      }),
    )
    expect(fields).toEqual([
      { field: 'email', message: 'Invalid email' },
      { field: 'salary', message: 'Expected number' },
    ])
  })

  it('keeps a nested path, so a row in a list can still be found', () => {
    expect(
      apiErrorFields(
        axiosError({ details: [{ path: ['body', 'lines', 0, 'quantity'], message: 'Too small' }] }),
      )[0]?.field,
    ).toBe('lines.0.quantity')

    expect(
      apiErrorFields(axiosError({ message: 'body/lines/0/quantity must be >= 1' }))[0]?.field,
    ).toBe('lines.0.quantity')
  })

  it('blames nothing when the failure is not about a field', () => {
    // ⚠️ THE IMPORTANT CASE. Highlighting an arbitrary input on a 500 or a
    // dropped connection sends the user to change something that was fine.
    expect(apiErrorFields(axiosError({ error: 'Internal Server Error' }))).toEqual([])
    expect(apiErrorFields(axiosError({ error: 'PERMISSION_OWNER_LOCKED' }))).toEqual([])
    expect(apiErrorFields(new Error('Network Error'))).toEqual([])
    expect(apiErrorFields(undefined)).toEqual([])
    expect(apiErrorFields(axiosError({ message: 'Something went wrong' }))).toEqual([])
  })

  it('survives a malformed body instead of crashing the form', () => {
    expect(apiErrorFields(axiosError({ details: 'nope' }))).toEqual([])
    expect(apiErrorFields(axiosError({ details: [{ path: ['body'], message: 'x' }] }))).toEqual([])
    expect(apiErrorFields(axiosError({ details: [{ path: ['body', 'a'] }] }))).toEqual([])
  })
})
