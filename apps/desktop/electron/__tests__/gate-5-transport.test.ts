// ============================================
// apps/desktop/electron/__tests__/gate-5-transport.test.ts
//
// Gate 5 Desktop Transport Verification Suite
// Verifies IPC handler registration, preload bridge binding, and
// in-process dispatch of @hisabche/local-engine on desktop (Electron).
// ============================================

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { IPC } from '@hisabche/app-bridge'
import { closeDatabase, initDatabaseWith } from '../main/db/database'
import { TestDriver } from '../main/db/__tests__/test-driver'
import { handleLocalApiRequest } from '../main/services/local-api'

const desktopRoot = join(__dirname, '..', '..')

describe('Gate 5: Desktop Local Transport & IPC Layer', () => {
  let tempDir: string
  let testDbPath: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hisabche-desktop-gate5-'))
    testDbPath = join(tempDir, 'desktop-gate5.db')
    initDatabaseWith(TestDriver as never, testDbPath)
  })

  afterAll(() => {
    closeDatabase()
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore temporary directory cleanup error
    }
  })

  describe('Preload Bridge Binding', () => {
    const preloadSource = readFileSync(join(desktopRoot, 'electron/preload/index.ts'), 'utf8')

    it('exposes window.localApi to the renderer via contextBridge', () => {
      expect(preloadSource).toContain("contextBridge.exposeInMainWorld('localApi'")
    })

    it('binds localApi.request to IPC.localApiRequest', () => {
      expect(preloadSource).toContain('ipcRenderer.invoke(IPC.localApiRequest, req)')
    })
  })

  describe('IPC Handler Registration', () => {
    const registerSource = readFileSync(join(desktopRoot, 'electron/main/ipc/register.ts'), 'utf8')

    it('defines IPC.localApiRequest channel constant', () => {
      expect(IPC.localApiRequest).toBe('local-api:request')
    })

    it('registers IPC handler for IPC.localApiRequest with handleLocalApiRequest', () => {
      expect(registerSource).toContain('handle(IPC.localApiRequest')
      expect(registerSource).toContain('handleLocalApiRequest(input as LocalEngineRequest)')
    })
  })

  describe('In-Process Engine Dispatch', () => {
    it('executes GET /workspaces request in-process without network', async () => {
      const res = await handleLocalApiRequest<Array<{ id: string; baseCurrency: string }>>({
        method: 'GET',
        path: '/workspaces',
      })

      expect(res.status).toBe(200)
      expect(res.data).toBeDefined()
      expect(Array.isArray(res.data)).toBe(true)
    })

    it('executes POST /products request and persists to SQLite', async () => {
      const res = await handleLocalApiRequest<{ id: string; name: string; sellPrice: number }>({
        method: 'POST',
        path: '/products',
        body: {
          name: 'روغن نباتی دسکتاپ',
          sellPrice: 1200,
          unit: 'liter',
        },
      })

      expect(res.status).toBe(201)
      expect(res.data.id).toBeDefined()
      expect(res.data.name).toBe('روغن نباتی دسکتاپ')
      expect(res.data.sellPrice).toBe(1200)

      // Query product back via GET /products/:id
      const getRes = await handleLocalApiRequest<{ id: string; name: string }>({
        method: 'GET',
        path: `/products/${res.data.id}`,
      })
      expect(getRes.status).toBe(200)
      expect(getRes.data.name).toBe('روغن نباتی دسکتاپ')
    })

    it('returns standard ApiError shape on invalid request', async () => {
      const res = await handleLocalApiRequest<{ error: string; code: string }>({
        method: 'GET',
        path: '/products/00000000-0000-0000-0000-000000000000',
      })

      expect(res.status).toBe(404)
      expect(res.data.error).toBeDefined()
    })
  })
})
