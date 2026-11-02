// ============================================
// packages/ui/src/__tests__/package-grants-panel.test.ts
//
// M5 / slice C guard - the package panel shows what the server derived and records ONE thing: a SUSPEND or RESUME of ONE GRANT.
//   · it decides no state itself (no date arithmetic, no balance) - the shared function answers;
//   · its only write is the suspension hook; it never expires, refunds, adjusts or reverses credit;
//   · the suspension is per GRANT (a grant id), never per customer;
//   · every string it shows exists in fa, af and en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const panel = readFileSync(
  join(
    ROOT,
    'packages',
    'ui',
    'src',
    'components',
    'ui',
    'service-delivery',
    'package-grants-panel.tsx',
  ),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const KEYS = [
  'title',
  'empty',
  'unread',
  'soldOn',
  'term',
  'months',
  'noTerm',
  'activatedOn',
  'notStarted',
  'endsOn',
  'reason',
  'reasonRequired',
  'confirm',
  'cancel',
  'suspend',
  'resume',
  'failed',
]
const STATES = ['active', 'not_started', 'expired', 'suspended']

describe('PackageGrantsPanel', () => {
  it('derives nothing: no date arithmetic, no balance, no state computation', () => {
    expect(panel).not.toMatch(/new Date|Date\.now|setMonth|getTime/)
    expect(panel).not.toMatch(/grantStateOn|planGrantConsumption|allocatableGrantsFromFacts/)
  })

  it('writes ONE thing - the suspension of one GRANT - and nothing that moves credit or money', () => {
    expect(panel).toContain('useRecordGrantSuspension')
    expect(panel).not.toMatch(
      /useExpirePackageCredit|useReversePackageCredit|useConsumePackageCredit|useAdjustPackageCredit|refund/i,
    )
    expect(panel).toMatch(/grantId: reasonFor\.id/)
    expect(panel).not.toMatch(/suspendCustomer|customer\.suspend/i)
  })

  it('a reason is required before anything is sent', () => {
    expect(panel).toMatch(/if \(!reason\.trim\(\)\)/)
  })

  for (const lang of ['fa', 'af', 'en']) {
    it(`has every string in ${lang}`, () => {
      const messages = JSON.parse(
        readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
      ) as { packageGrants?: Record<string, unknown> }
      for (const key of KEYS)
        expect(messages.packageGrants?.[key], `${lang}:${key}`).toEqual(expect.any(String))
      for (const state of STATES) {
        expect(
          (messages.packageGrants?.state as Record<string, string> | undefined)?.[state],
          `${lang}:state.${state}`,
        ).toEqual(expect.any(String))
      }
    })
  }
})
