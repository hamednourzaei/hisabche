import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePackManifest } from '../packs/manifest'
import { planInstall } from '../packs/plan'
import { PackStore } from '../packs/store'
import { safeJoinRoot, sha256Hex } from '../packs/verify'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-packs-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function makeSignedBundle(buildId: string, chunkBytes: Buffer, withdrawn = false) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  const manifestObj = {
    schemaVersion: 1 as const,
    coreBuildId: buildId,
    generatedAt: '2026-11-12T00:00:00Z',
    packs: {
      core: {
        id: 'core',
        files: [],
        dependsOn: [],
        withdrawn: false,
      },
      manufacturing: {
        id: 'manufacturing',
        files: [
          {
            path: 'assets/pack-manufacturing.js',
            sha256: sha256Hex(chunkBytes),
            sizeBytes: chunkBytes.length,
          },
        ],
        dependsOn: ['core'],
        withdrawn,
      },
    },
  }
  const manifestBytes = Buffer.from(JSON.stringify(manifestObj), 'utf8')
  const sig = cryptoSign(null, manifestBytes, privateKey).toString('base64')
  return { manifestObj, manifestBytes, sig, publicKeyPem }
}

describe('PackStore & verification (V62 Slice 8)', () => {
  it('plans install, upgrade, remove, and blocks withdrawn packs', () => {
    const manifest = parsePackManifest({
      schemaVersion: 1,
      coreBuildId: 'build-2',
      generatedAt: '2026-11-12T00:00:00Z',
      packs: {
        core: { id: 'core', files: [], dependsOn: [], withdrawn: false },
        manufacturing: {
          id: 'manufacturing',
          files: [{ path: 'assets/m.js', sha256: 'a'.repeat(64), sizeBytes: 10 }],
          dependsOn: ['core'],
          withdrawn: false,
        },
        approvals: {
          id: 'approvals',
          files: [{ path: 'assets/a.js', sha256: 'b'.repeat(64), sizeBytes: 10 }],
          dependsOn: ['core'],
          withdrawn: true,
        },
      },
    })

    const plan = planInstall(manifest, { coreBuildId: 'build-2', packs: ['core', 'workforce'] }, [
      'manufacturing',
      'approvals',
    ])
    expect(plan.toKeep).toEqual(['core'])
    expect(plan.toDownload).toEqual(['manufacturing'])
    expect(plan.toRemove).toEqual(['workforce'])
    expect(plan.blockedWithdrawn).toEqual(['approvals'])
  })

  it('installs verified build atomically and rejects bad signature or bad sha256', () => {
    const root = makeTempDir()
    const store = new PackStore(root)
    const chunk = Buffer.from('console.log("manufacturing")', 'utf8')
    const { manifestBytes, sig, publicKeyPem } = makeSignedBundle('build-100', chunk)

    expect(() =>
      store.installVerifiedBuild({
        manifestBytes,
        signatureBase64: Buffer.from('bad-sig').toString('base64'),
        publicKeyPem,
        selectedPacks: ['core', 'manufacturing'],
        files: new Map([['assets/pack-manufacturing.js', chunk]]),
      }),
    ).toThrow(/PACK_MANIFEST_SIGNATURE_INVALID/)

    expect(() =>
      store.installVerifiedBuild({
        manifestBytes,
        signatureBase64: sig,
        publicKeyPem,
        selectedPacks: ['core', 'manufacturing'],
        files: new Map([['assets/pack-manufacturing.js', Buffer.from('tampered')]]),
      }),
    ).toThrow(/PACK_FILE_HASH_MISMATCH/)

    const installed = store.installVerifiedBuild({
      manifestBytes,
      signatureBase64: sig,
      publicKeyPem,
      selectedPacks: ['core', 'manufacturing'],
      files: new Map([['assets/pack-manufacturing.js', chunk]]),
    })
    expect(installed.coreBuildId).toBe('build-100')
    expect(installed.packs).toEqual(['core', 'manufacturing'])
    expect(store.resolveVerifiedAsset('build-100', 'assets/pack-manufacturing.js')).toBeTruthy()
    expect(store.resolveVerifiedAsset('build-100', 'assets/unlisted.js')).toBeNull()
  })

  it('cleans interrupted staging, enforces GC (current + previous), and refuses path traversal', () => {
    const root = makeTempDir()
    const store = new PackStore(root)
    const staleStage = path.join(store.stagingDir, 'interrupted-build')
    fs.mkdirSync(staleStage, { recursive: true })
    fs.writeFileSync(path.join(staleStage, 'partial.js'), 'broken')

    expect(store.cleanupInterruptedStaging()).toEqual(['interrupted-build'])
    expect(fs.existsSync(staleStage)).toBe(false)

    fs.mkdirSync(path.join(store.packsDir, 'build-1'), { recursive: true })
    fs.mkdirSync(path.join(store.packsDir, 'build-2'), { recursive: true })
    fs.mkdirSync(path.join(store.packsDir, 'build-3'), { recursive: true })

    const deleted = store.garbageCollect('build-3', 'build-2')
    expect(deleted).toEqual(['build-1'])
    expect(fs.existsSync(path.join(store.packsDir, 'build-2'))).toBe(true)
    expect(fs.existsSync(path.join(store.packsDir, 'build-3'))).toBe(true)

    expect(() => safeJoinRoot(root, '../../etc/passwd')).toThrow(/PATH_TRAVERSAL_REFUSED/)
  })
})
