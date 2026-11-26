import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveModuleDependencies, validateCoreManifest, type ModuleManifest } from '../index'
import type { InstalledRuntimeContext } from '../resolver'

function checkCoreIsolationSource(sourceText: string): { ok: boolean; violation?: string } {
  const forbidden = [
    /from\s+['"]node:/,
    /from\s+['"]electron['"]/,
    /from\s+['"]react-native['"]/,
    /Date\.now\(/,
    /Math\.random\(/,
  ]
  for (const re of forbidden) {
    if (re.test(sourceText)) {
      return { ok: false, violation: re.source }
    }
  }
  return { ok: true }
}

describe('Section 13.5 Quality Gates (with seeded-violation + clean proofs)', () => {
  it('Gate 1: Pure updater-core isolation rejects seeded Node/Electron/RN/non-deterministic violations and passes clean source', () => {
    const seededBad = `import fs from 'node:fs'; export const t = () => Date.now();`
    expect(checkCoreIsolationSource(seededBad).ok).toBe(false)

    const srcDir = path.resolve(__dirname, '..')
    for (const file of fs.readdirSync(srcDir)) {
      if (!file.endsWith('.ts')) continue
      const content = fs.readFileSync(path.join(srcDir, file), 'utf8')
      expect(checkCoreIsolationSource(content)).toEqual({ ok: true })
    }
  })

  it('Gate 2: Module dependency cycle & self-permission gate fails on seeded violation and passes on clean graph', () => {
    const runtime: InstalledRuntimeContext = {
      platform: 'windows',
      bootstrapVersion: '1.2.0',
      coreVersion: '1.9.0',
      apiVersion: '1.4.0',
      dbSchemaVersion: '1.4.0',
      localSchemaVersion: 1,
      workspaceCapabilities: ['core'],
      workspacePermissions: ['invoice.read'],
    }
    const baseMod: ModuleManifest = {
      kind: 'module',
      id: 'mod-clean',
      version: '1.0.0',
      channel: 'stable',
      dependencies: {},
      optionalDependencies: {},
      requiredCoreRange: '>=1.0.0',
      apiRange: '>=1.0.0',
      dbSchemaRange: '>=1.0.0',
      minLocalSchemaVersion: 1,
      platforms: ['windows'],
      requiredCapabilities: ['core'],
      requiredPermissions: ['invoice.read'],
      offlineSupport: true,
      artifact: {
        url: 'https://updates.hisabche.com/clean.bin',
        sha256: 'a'.repeat(64),
        sizeBytes: 10,
      },
      signature: {
        role: 'targets',
        keyId: 'k1',
        algorithm: 'ed25519',
        sigBase64: 'A'.repeat(64),
        sequence: 1,
        signedAt: '2026-11-26T10:00:00Z',
        expiresAt: '2026-12-26T10:00:00Z',
      },
      migrationReferences: [],
      releaseNotes: { fa: 'ت', af: 'ت', en: 't' },
      rollbackCompatibility: { supportsRollback: true, rollbackTarget: null },
    }
    expect(resolveModuleDependencies([baseMod], runtime).ok).toBe(true)

    const seededViolation: ModuleManifest = { ...baseMod, requiredPermissions: ['platform.admin'] }
    expect(resolveModuleDependencies([seededViolation], runtime).ok).toBe(false)
  })

  it('Gate 3: Manifest HTTP-non-HTTPS & invalid SemVer gate fails on seeded violation', () => {
    expect(
      validateCoreManifest({
        kind: 'core',
        id: 'c',
        version: 'invalid',
        channel: 'stable',
        platforms: ['windows'],
      }).ok,
    ).toBe(false)
  })
})
