// ============================================
// Plan, industry and permission are three independent answers (V72 · S3 · G4).
//
//   · plan gating: `resolveEntitlement` decides from the workspace's STATE,
//     PLAN, EDITION and usage — never from its industry, DNA or a person's role;
//   · permission: `holds` decides from the role / custom-role capabilities —
//     never from the plan or the industry;
//   · an ended plan locks writes, never the reads it promises (principle 6).
//
// The first version of this file asserted `expect('employee').not.toBe('ONLINE_1500')`,
// which can never fail. These read the two functions themselves.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveEntitlement, type EntitlementInput } from '../schemas/entitlement-resolver'
import { FEATURE_KEYS, featureDefinition, type FeaturePlan } from '../schemas/feature-registry'

const ROOT = path.resolve(__dirname, '../../../..')
const code = (relative: string) =>
  fs
    .readFileSync(path.join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** The body of one exported function, comments removed. */
function bodyOf(relative: string, name: string): string {
  const src = code(relative)
  const start = src.indexOf(`export function ${name}(`)
  expect({ name, found: start >= 0 }).toEqual({ name, found: true })
  const next = src.indexOf('\nexport ', start + 1)
  return src.slice(start, next < 0 ? undefined : next)
}

const PLANS: readonly FeaturePlan[] = [
  'FREE',
  'OFFLINE',
  'ONLINE_500',
  'ONLINE_1000',
  'ONLINE_1500',
]

describe('plan gating does not read the industry, the DNA or the role', () => {
  it('resolveEntitlement and its input name none of them', () => {
    const resolver = bodyOf(
      'packages/validation/src/schemas/entitlement-resolver.ts',
      'resolveEntitlement',
    )
    const input = code('packages/validation/src/schemas/entitlement-resolver.ts').match(
      /export interface EntitlementInput \{[\s\S]*?\n\}/,
    )?.[0]
    expect(input).toBeDefined()
    for (const word of ['industry', 'trade', 'dna', 'role', 'capabilit']) {
      expect({ word, inResolver: new RegExp(word, 'i').test(resolver) }).toEqual({
        word,
        inResolver: false,
      })
      expect({ word, inInput: new RegExp(word, 'i').test(String(input)) }).toEqual({
        word,
        inInput: false,
      })
    }
  })

  it('the same plan gives the same verdict for every feature, whoever asks', () => {
    // The input has no slot for a trade or a person; two calls with equal input agree.
    for (const plan of PLANS) {
      const input: EntitlementInput = {
        state: 'ONLINE_ACTIVE',
        plan,
        edition: plan === 'OFFLINE' ? 'local' : 'cloud',
      }
      for (const feature of FEATURE_KEYS) {
        expect(resolveEntitlement(input, feature)).toEqual(
          resolveEntitlement({ ...input }, feature),
        )
      }
    }
  })

  it('an expired plan keeps every always-allowed read and locks the rest', () => {
    for (const feature of FEATURE_KEYS) {
      const verdict = resolveEntitlement(
        { state: 'ONLINE_EXPIRED', plan: 'ONLINE_1500', edition: 'cloud' },
        feature,
      )
      const expected = featureDefinition(feature).alwaysAllowed === true ? 'AVAILABLE' : 'EXPIRED'
      expect({ feature, kind: verdict.kind }).toEqual({ feature, kind: expected })
    }
  })
})

describe('permission does not read the plan or the industry', () => {
  it('holds() decides from the role and its capabilities only', () => {
    const holds = bodyOf('backend/src/services/authorization/authorization.domain.ts', 'holds')
    for (const word of ['plan', 'entitlement', 'subscription', 'industry', 'trade', 'dna']) {
      expect({ word, inHolds: new RegExp(word, 'i').test(holds) }).toEqual({ word, inHolds: false })
    }
  })
})
