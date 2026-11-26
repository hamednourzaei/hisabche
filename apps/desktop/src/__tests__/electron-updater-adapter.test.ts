import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  runFileStoreContractSuite,
  runSecureStoreContractSuite,
} from '../../../../packages/updater-core/src/__tests__/adapter-contract'
import {
  DesktopProcessLockPort,
  FileBackedSecureStore,
  NodeElectronFileStore,
} from '../../electron/main/services/updater-ports'

describe('Slice S4 — Electron Node adapter contracts & Windows filesystem guards', () => {
  it('passes shared FileStore & SecureStore adapter contracts on real filesystem', async () => {
    await runFileStoreContractSuite(async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-s4-fs-'))
      return {
        fileStore: new NodeElectronFileStore(tmp),
        cleanup: async () => fs.rmSync(tmp, { recursive: true, force: true }),
      }
    })

    await runSecureStoreContractSuite(async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-s4-sec-'))
      return {
        secureStore: new FileBackedSecureStore(tmp, 'win-device-01'),
        cleanup: async () => fs.rmSync(tmp, { recursive: true, force: true }),
      }
    })
  })

  it('refuses Windows reserved names, path traversal, and concurrent instance lock', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-s4-guard-'))
    try {
      const store = new NodeElectronFileStore(tmp)
      await expect(store.writeBytes('../escape.txt', new Uint8Array([1]))).rejects.toThrow(
        'PATH_TRAVERSAL_REFUSED',
      )
      await expect(store.writeBytes('slots/CON.txt', new Uint8Array([1]))).rejects.toThrow(
        'UNSAFE_PATH_SEGMENT',
      )

      const proc = new DesktopProcessLockPort(tmp, async () => {})
      expect(await proc.acquireUpdateLock('update:core')).toBe(true)
      expect(await proc.acquireUpdateLock('update:core')).toBe(false)
      await proc.releaseUpdateLock('update:core')
      expect(await proc.acquireUpdateLock('update:core')).toBe(true)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})
