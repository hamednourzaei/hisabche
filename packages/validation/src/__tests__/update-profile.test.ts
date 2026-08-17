// ============================================
// Editing a profile was returning 400 "ذخیره نشد" for anyone without a
// business name: the form sends `null` for an empty field and `z.string()`
// refused it. A PATCH has to read `null` as "clear this", not as invalid.
// ============================================

import { describe, expect, it } from 'vitest'

import { updateProfileSchema } from '../schemas/auth.schema'

describe('updateProfileSchema', () => {
  it('accepts a null business name and normalizes it to empty', () => {
    const parsed = updateProfileSchema.parse({ fullName: 'مجید', businessName: null })
    expect(parsed.businessName).toBe('')
  })

  it('accepts an empty business name unchanged', () => {
    expect(updateProfileSchema.parse({ fullName: 'مجید', businessName: '' }).businessName).toBe('')
  })

  it('keeps a real business name', () => {
    expect(
      updateProfileSchema.parse({ fullName: 'مجید', businessName: 'طلافروشی' }).businessName,
    ).toBe('طلافروشی')
  })

  it('accepts a null avatar and normalizes it to empty', () => {
    expect(updateProfileSchema.parse({ fullName: 'مجید', avatarUrl: null }).avatarUrl).toBe('')
  })

  it('accepts an empty avatar url', () => {
    expect(updateProfileSchema.parse({ avatarUrl: '' }).avatarUrl).toBe('')
  })

  it('accepts a real avatar url', () => {
    const url = 'https://example.com/a.png'
    expect(updateProfileSchema.parse({ avatarUrl: url }).avatarUrl).toBe(url)
  })

  it('still rejects a malformed avatar url', () => {
    expect(() => updateProfileSchema.parse({ avatarUrl: 'not-a-url' })).toThrow()
  })

  it('allows a partial patch with only one field', () => {
    const parsed = updateProfileSchema.parse({ fullName: 'مجید' })
    expect(parsed.fullName).toBe('مجید')
    expect(parsed.businessName).toBeUndefined()
  })

  it('allows an empty patch', () => {
    expect(updateProfileSchema.parse({})).toEqual({})
  })

  it('still rejects an empty full name', () => {
    // Clearing your own name is not a thing a profile edit should allow.
    expect(() => updateProfileSchema.parse({ fullName: '' })).toThrow()
  })

  it('still rejects a business name past the column limit', () => {
    expect(() => updateProfileSchema.parse({ businessName: 'x'.repeat(201) })).toThrow()
  })
})
