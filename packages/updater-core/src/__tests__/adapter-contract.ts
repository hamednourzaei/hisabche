import assert from 'node:assert/strict'
import type { FileStore, SecureStore } from '../ports'

/**
 * Shared adapter contract test suite (§4, §13.1.4).
 * Uses node:assert/strict so both Vitest and Jest execute it identically.
 */
export async function runFileStoreContractSuite(
  createStore: () => Promise<{ fileStore: FileStore; cleanup: () => Promise<void> }>,
): Promise<void> {
  const { fileStore, cleanup } = await createStore()
  try {
    await fileStore.mkdirp('slots/core/.staging-1.0.0')
    const data = new TextEncoder().encode('hello-adapter-contract')
    await fileStore.writeBytes('slots/core/.staging-1.0.0/bundle.bin', data)
    assert.equal(await fileStore.exists('slots/core/.staging-1.0.0/bundle.bin'), true)

    const readBack = await fileStore.readBytes('slots/core/.staging-1.0.0/bundle.bin')
    assert.equal(new TextDecoder().decode(readBack), 'hello-adapter-contract')

    await fileStore.atomicRename('slots/core/.staging-1.0.0', 'slots/core/1.0.0')
    assert.equal(await fileStore.exists('slots/core/1.0.0/bundle.bin'), true)
    assert.equal(await fileStore.exists('slots/core/.staging-1.0.0/bundle.bin'), false)

    const listed = await fileStore.list('slots/core')
    assert.ok(listed.includes('1.0.0'))

    const free = await fileStore.freeSpaceBytes('slots/core')
    assert.ok(free > 0)

    await fileStore.remove('slots/core/1.0.0')
    assert.equal(await fileStore.exists('slots/core/1.0.0/bundle.bin'), false)
  } finally {
    await cleanup()
  }
}

export async function runSecureStoreContractSuite(
  createSecureStore: () => Promise<{ secureStore: SecureStore; cleanup: () => Promise<void> }>,
): Promise<void> {
  const { secureStore, cleanup } = await createSecureStore()
  try {
    assert.equal(await secureStore.getSequence('core'), 0)
    await secureStore.setSequence('core', 42)
    assert.equal(await secureStore.getSequence('core'), 42)

    await secureStore.setState('updater:test', '{"ok":true}')
    assert.equal(await secureStore.getState('updater:test'), '{"ok":true}')
    assert.ok((await secureStore.getDeviceId()).length > 0)
  } finally {
    await cleanup()
  }
}
