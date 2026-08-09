// ============================================
// PATCH /api/workspaces/:id — body contract.
//
// Regression guard for a 400 that broke the whole settings page:
// `updateWorkspaceSchema` is `workspaceSchema.partial().extend({ id })`, which
// makes `id` REQUIRED IN THE BODY. The id lives in the URL, so the client
// correctly sent only the changed fields and Fastify rejected every request
// with "body must have required property 'id'".
//
// The route now validates against `updateWorkspaceSchema.omit({ id: true })`.
// These tests pin that shape.
// ============================================

import { describe, expect, it } from 'vitest'

import { updateWorkspaceSchema } from '../index'

const bodySchema = updateWorkspaceSchema.omit({ id: true })

describe('the body schema does not demand an id', () => {
  it('accepts a partial update with no id — the whole point', () => {
    expect(bodySchema.safeParse({ name: 'کسب‌وکار من' }).success).toBe(true)
  })

  it('accepts an empty body (a no-op PATCH is not an error)', () => {
    expect(bodySchema.safeParse({}).success).toBe(true)
  })

  it('REGRESSION: the un-omitted schema is exactly what caused the 400', () => {
    // Documents the trap so nobody reintroduces it by swapping the schema back.
    expect(updateWorkspaceSchema.safeParse({ name: 'x' }).success).toBe(false)
  })
})

describe('logo and stamp accept an uploaded image', () => {
  const dataUri =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  it('takes a base64 data URI for both fields', () => {
    const parsed = bodySchema.safeParse({ logoUrl: dataUri, stampUrl: dataUri })
    expect(parsed.success).toBe(true)
  })

  it('still takes an ordinary https URL', () => {
    expect(bodySchema.safeParse({ logoUrl: 'https://cdn.example.com/logo.png' }).success).toBe(true)
  })

  it('accepts null to clear an image', () => {
    expect(bodySchema.safeParse({ logoUrl: null, stampUrl: null }).success).toBe(true)
  })

  it('both fields behave identically — they used to disagree', () => {
    for (const value of [dataUri, 'https://cdn.example.com/a.png', null]) {
      expect(bodySchema.safeParse({ logoUrl: value }).success).toBe(
        bodySchema.safeParse({ stampUrl: value }).success,
      )
    }
  })

  it('rejects an absurdly large payload rather than accepting it unbounded', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(10_000_001)
    expect(bodySchema.safeParse({ logoUrl: huge }).success).toBe(false)
  })
})
