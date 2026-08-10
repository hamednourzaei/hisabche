// ============================================
// The request interceptor applies a default `limit=50` so list screens paginate
// without every caller repeating it. It must not apply that to a single-record
// read: `GET /invoices/:id?limit=50` was reaching production, where the stray
// parameter became part of the server's cache key and made an item read look
// like a list read.
// ============================================

import { describe, expect, it } from 'vitest'

import { isCollectionUrl } from '../lib/client'

describe('isCollectionUrl', () => {
  it.each(['/invoices', '/customers', '/warehouse/products', '/activities'])(
    'treats %s as a collection',
    (url) => {
      expect(isCollectionUrl(url)).toBe(true)
    },
  )

  it.each([
    '/invoices/e54f9bbb-b677-45d1-87f5-585287115cce',
    '/customers/2aa99387-2cb3-47bf-8273-0f77fab98d06',
    '/invoices/42',
  ])('treats %s as a single record', (url) => {
    expect(isCollectionUrl(url)).toBe(false)
  })

  it('ignores an existing query string when classifying', () => {
    expect(isCollectionUrl('/invoices/e54f9bbb-b677-45d1-87f5-585287115cce?expand=items')).toBe(
      false,
    )
    expect(isCollectionUrl('/invoices?status=paid')).toBe(true)
  })

  it('ignores a trailing slash', () => {
    expect(isCollectionUrl('/invoices/')).toBe(true)
  })

  it('treats a sub-collection under a record as a collection', () => {
    // `/invoices/:id/items` is a list, even though a record id appears in it.
    expect(isCollectionUrl('/invoices/e54f9bbb-b677-45d1-87f5-585287115cce/items')).toBe(true)
  })

  it('does not default a limit when there is no url to classify', () => {
    expect(isCollectionUrl(undefined)).toBe(false)
  })
})
