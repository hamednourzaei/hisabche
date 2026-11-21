// ============================================
// The advance id must be a uuid, not the invoice's prefixed idempotency key.
//
// Reported on /fa/invoices/new/preview?type=pre_purchase: confirming showed
// «id: Invalid uuid» and nothing was recorded. The preview sent
// `submissionKey` (`inv_web_<uuid>`) as the advance's `id`, and the advances
// endpoint types that field as a uuid.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { advanceIdFromSubmissionKey } from '../lib/invoices/advance-id'

const UUID = '3f0c1a10-6a4e-4b4e-9d54-0d0a7f2c9b11'

describe('the advance id comes from the draft key', () => {
  it('strips the invoice prefix, leaving the uuid the schema expects', () => {
    expect(advanceIdFromSubmissionKey(`inv_web_${UUID}`)).toBe(UUID)
  })

  it('accepts a bare uuid, so an older draft still records', () => {
    expect(advanceIdFromSubmissionKey(UUID)).toBe(UUID)
  })

  it('refuses anything that is not a uuid instead of sending it', () => {
    expect(advanceIdFromSubmissionKey('inv_web_not-a-uuid')).toBeUndefined()
    expect(advanceIdFromSubmissionKey('')).toBeUndefined()
    expect(advanceIdFromSubmissionKey('inv_web_')).toBeUndefined()
  })
})

describe('the preview sends that value, never the raw key', () => {
  const source = readFileSync(
    join(
      __dirname,
      '..',
      'components',
      'ui',
      'invoice-builder',
      'containers',
      'invoice-preview-container.tsx',
    ),
    'utf8',
  )
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

  it('derives the id from the submission key', () => {
    expect(source).toContain('advanceIdFromSubmissionKey(submissionKey)')
  })

  it('does not pass the prefixed key as the advance id', () => {
    expect(source).not.toMatch(/id:\s*submissionKey/)
  })
})
