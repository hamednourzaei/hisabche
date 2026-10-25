import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../../../')
const PACKAGES_DIR = path.join(ROOT, 'packages')
const VALIDATION_SRC = path.join(ROOT, 'packages/validation/src')

describe('Architecture Boundaries & Core Mechanical Enforcement', () => {
  it('strictly forbids packages/domain or any second domain package', () => {
    const packages = fs
      .readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)

    const domainPackages = packages.filter((pkg) => pkg.toLowerCase().includes('domain'))
    expect(domainPackages, 'packages/domain or duplicate domain package must not exist').toEqual([])
  })

  it('ensures packages/validation has zero forbidden external or peer imports', () => {
    const forbiddenPatterns = [
      '@hisabche/ui',
      '@hisabche/api',
      '@hisabche/app-shell',
      '@hisabche/local-engine',
      '@hisabche/app-bridge',
      'backend/',
      'apps/',
      'react',
      'react-dom',
      'next',
      'electron',
      'react-native',
      'better-sqlite3',
      '@supabase/supabase-js',
      'pg',
    ]

    function scanFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__' && entry.name !== '__golden__') {
            files.push(...scanFiles(full))
          }
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          files.push(full)
        }
      }
      return files
    }

    const sourceFiles = scanFiles(VALIDATION_SRC)
    const violations: { file: string; pattern: string }[] = []

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8')
      for (const pattern of forbiddenPatterns) {
        const regex = new RegExp(`from\\s+['"]${pattern}['"]|import\\(['"]${pattern}['"]\\)`, 'g')
        if (regex.test(content)) {
          violations.push({ file: path.relative(ROOT, file), pattern })
        }
      }
    }

    expect(
      violations,
      'packages/validation must remain a pure, zero-framework dependency core',
    ).toEqual([])
  })

  it('guarantees one definition per core business rule across the codebase', () => {
    const rulesToTest = [
      { name: 'buildProfitReport', declRegex: /export\s+function\s+buildProfitReport\s*\(/g },
      { name: 'buildInstallmentPlan', declRegex: /export\s+function\s+buildInstallmentPlan\s*\(/g },
      { name: 'planPayrollOutcome', declRegex: /export\s+function\s+planPayrollOutcome\s*\(/g },
      { name: 'buildGeneralLedger', declRegex: /export\s+function\s+buildGeneralLedger\s*\(/g },
    ]

    const searchDirs = [path.join(ROOT, 'backend/src'), path.join(ROOT, 'packages')]

    function scanAllTs(dir: string): string[] {
      if (!fs.existsSync(dir)) return []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo')
          continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...scanAllTs(full))
        } else if (
          entry.name.endsWith('.ts') &&
          !entry.name.endsWith('.d.ts') &&
          !entry.name.includes('.test.')
        ) {
          files.push(full)
        }
      }
      return files
    }

    const allTsFiles = searchDirs.flatMap(scanAllTs)

    for (const rule of rulesToTest) {
      const definitionSites: string[] = []
      for (const file of allTsFiles) {
        const content = fs.readFileSync(file, 'utf8')
        if (rule.declRegex.test(content)) {
          definitionSites.push(path.relative(ROOT, file).replace(/\\/g, '/'))
        }
      }
      expect(
        definitionSites.length,
        `Rule "${rule.name}" must have exactly ONE definition site across backend & packages, found: ${JSON.stringify(definitionSites)}`,
      ).toBe(1)
    }
  })

  it('ships no port or event scaffolding that nothing consumes', () => {
    // ⚠️ `Clock`, `IdGenerator`, `UnitOfWork`, `CommandHandler` and
    // `DomainEventHeader` used to live in `schemas/domain-ports.ts` and
    // `schemas/domain-events.ts`. They had no production consumer; the only
    // code that touched them was a test instantiating `FixedClock` and
    // `SequenceIdGenerator`, which proved nothing about the product.
    //
    // Project rule §14: unconnected scaffolding is deleted, not shelved. This
    // asserts it has not quietly come back as decoration. Wiring a port into a
    // real command handler is a design change and needs its own ADR — at which
    // point this test should be replaced by one that proves the CONSUMER.
    for (const file of ['domain-ports.ts', 'domain-events.ts']) {
      expect(
        fs.existsSync(path.join(VALIDATION_SRC, 'schemas', file)),
        `${file} reappeared without a consumer — see the note in index.ts`,
      ).toBe(false)
    }
  })
})
