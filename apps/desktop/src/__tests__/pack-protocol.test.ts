import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { PackStore } from '@hisabche/app-bridge/packs-node'
import { sha256Hex } from '@hisabche/app-bridge/packs-verify'

import {
  APP_PROTOCOL_ORIGIN,
  buildRendererCsp,
  resolvePackProtocolFile,
} from '../../electron/main/protocol'

jest.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  net: { fetch: jest.fn() },
  protocol: {
    registerSchemesAsPrivileged: jest.fn(),
    handle: jest.fn(),
  },
}))

const tempDirs: string[] = []
function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-proto-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('hisabche-app:// protocol resolver (V62 Slice 8)', () => {
  it('resolves bundled assets first, then verified pack store assets', () => {
    const root = makeTempDir()
    const bundledRoot = path.join(root, 'bundled')
    const storeRoot = path.join(root, 'userData')
    fs.mkdirSync(path.join(bundledRoot, 'assets'), { recursive: true })
    const bundledIndex = path.join(bundledRoot, 'index.html')
    const bundledCore = path.join(bundledRoot, 'assets/core.js')
    fs.writeFileSync(bundledIndex, '<html>bundled</html>')
    fs.writeFileSync(bundledCore, 'console.log("bundled")')

    const packStore = new PackStore(storeRoot)
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const packChunk = Buffer.from('console.log("pack")', 'utf8')
    const manifestBytes = Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        coreBuildId: 'b1',
        generatedAt: '2026-11-12T00:00:00Z',
        packs: {
          manufacturing: {
            id: 'manufacturing',
            files: [
              {
                path: 'assets/pack-manufacturing.js',
                sha256: sha256Hex(packChunk),
                sizeBytes: packChunk.length,
              },
            ],
            dependsOn: [],
            withdrawn: false,
          },
        },
      }),
      'utf8',
    )
    const sig = cryptoSign(null, manifestBytes, privateKey).toString('base64')
    packStore.installVerifiedBuild({
      manifestBytes,
      signatureBase64: sig,
      publicKeyPem,
      selectedPacks: ['manufacturing'],
      files: new Map([['assets/pack-manufacturing.js', packChunk]]),
    })

    // Unlisted file in store must be refused
    fs.writeFileSync(path.join(packStore.packsDir, 'b1/assets/unlisted.js'), 'evil')

    expect(
      resolvePackProtocolFile({
        requestUrl: `${APP_PROTOCOL_ORIGIN}/index.html`,
        bundledRoot,
        packStore,
        buildId: 'b1',
      }),
    ).toBe(bundledIndex)

    expect(
      resolvePackProtocolFile({
        requestUrl: `${APP_PROTOCOL_ORIGIN}/assets/pack-manufacturing.js`,
        bundledRoot,
        packStore,
        buildId: 'b1',
      }),
    ).toBe(path.join(packStore.packsDir, 'b1/assets/pack-manufacturing.js'))

    expect(
      resolvePackProtocolFile({
        requestUrl: `${APP_PROTOCOL_ORIGIN}/assets/unlisted.js`,
        bundledRoot,
        packStore,
        buildId: 'b1',
      }),
    ).toBeNull()

    expect(
      resolvePackProtocolFile({
        requestUrl: `${APP_PROTOCOL_ORIGIN}/../../etc/passwd`,
        bundledRoot,
        packStore,
        buildId: 'b1',
      }),
    ).toBeNull()
  })

  it('uses the same APP_PROTOCOL_ORIGIN constant in CSP when enabled', () => {
    const csp = buildRendererCsp(true)
    expect(csp).toContain(`script-src 'self' ${APP_PROTOCOL_ORIGIN}`)
    expect(buildRendererCsp(false)).toContain("script-src 'self';")
  })
})
