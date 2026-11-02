// ============================================
// backend/src/__tests__/package-credit-has-no-refund.test.ts
//
// The owner's decision of 2 Nov 2026 (M5-2): «نه هیچ بازپرداختی وجود ندارد» - package credit is NEVER refunded.
//
// A refund is not "not built yet": it is NOT OFFERED. This guard keeps it from appearing by accident -
// as a ledger entry type, as a route, as a client hook, as a feature or as a screen string.
// If the owner ever reverses the decision, this file is the one to change (and the decision register with it).
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PACKAGE_CREDIT_ENTRY_TYPES } from '@hisabche/validation'

const ROOT = join(__dirname, '..', '..', '..')

describe('package credit has no refund', () => {
  it('there is no REFUND ledger entry type', () => {
    expect([...PACKAGE_CREDIT_ENTRY_TYPES].map(String)).not.toContain('REFUND')
    expect([...PACKAGE_CREDIT_ENTRY_TYPES].some((type) => /refund/i.test(type))).toBe(false)
  })

  it('the SQL ledger CHECK does not allow one', () => {
    const migration = readFileSync(
      join(ROOT, 'docs', 'package-credit-ledger-01-migration.sql'),
      'utf8',
    )
    const check =
      /chk_package_credit_ledger_entry_type[\s\S]{0,200}?CHECK \(entry_type IN \(([^)]*)\)\)/.exec(
        migration,
      )
    expect(check, 'the entry_type CHECK was not found').not.toBeNull()
    expect(check![1]).not.toMatch(/refund/i)
  })

  it('no package-credit route is a refund', () => {
    const routes = readFileSync(
      join(ROOT, 'backend', 'src', 'routes', 'package-credits.routes.ts'),
      'utf8',
    )
    expect(routes).not.toMatch(/['"`]\/api\/package-credits\/[a-z-]*refund/i)
  })

  it('no client hook, device route or service-delivery file offers one', () => {
    const files = [
      join(ROOT, 'packages', 'api', 'src', 'hooks', 'universal-core.ts'),
      join(ROOT, 'packages', 'local-engine', 'src', 'routes', 'package-credits.ts'),
      join(ROOT, 'backend', 'src', 'services', 'package-credits', 'package-credits.service.ts'),
    ]
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(text, file).not.toMatch(
        /package[-_ ]?credit[-_ ]?refund|refundPackage|usePackageCreditRefund/i,
      )
    }
  })

  it('no screen of the service-delivery feature mentions a refund of credit', () => {
    const dir = join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'service-delivery')
    for (const name of readdirSync(dir).filter((file) => /\.(ts|tsx)$/.test(file))) {
      const text = readFileSync(join(dir, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(text, name).not.toMatch(/refund/i)
    }
  })
})
