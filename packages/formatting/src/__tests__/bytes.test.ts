import { describe, expect, it } from 'vitest'

import { formatBytes } from '../bytes'

describe('formatBytes', () => {
  it('scales to the largest unit below 1000 of it', () => {
    expect(formatBytes(0, 'en')).toBe('0 byte')
    expect(formatBytes(999, 'en')).toBe('999 byte')
    expect(formatBytes(1500, 'en')).toBe('1.5 kB')
    expect(formatBytes(24_000_000, 'en')).toBe('24 MB')
    expect(formatBytes(3_210_000_000, 'en')).toBe('3.2 GB')
  })

  it('writes digits in the reader’s language', () => {
    expect(formatBytes(1_500_000, 'fa-IR')).toContain('۱٫۵')
    expect(formatBytes(1_500_000, 'fa-AF')).toContain('۱٫۵')
  })

  it('never prints NaN or a negative size', () => {
    expect(formatBytes(Number.NaN, 'en')).toBe('0 byte')
    expect(formatBytes(-5, 'en')).toBe('0 byte')
  })
})
