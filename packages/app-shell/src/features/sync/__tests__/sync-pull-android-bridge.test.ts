// The shell's HTTP adapter on each host. Android's bridge is JSON, so a binary
// sync page arrives as base64 (`bytesBase64`); desktop's IPC hands back the
// bytes. Both must decode to the very same page — before this, Android read
// the page as text and every pull would have failed (caught before deploy,
// 27 Sep 2026).
import { bytesToBase64, type HisabcheBridge } from '@hisabche/app-bridge'
import { decodePullPage, encodePullPage, HSB_CONTENT_TYPE } from '@hisabche/sync/wire'

import { buildUrl, createHostHttpAdapter } from '../../../shared/lib/host-http-adapter'

const page = {
  changes: [
    {
      syncVersion: 9,
      entityType: 'product',
      entityId: '00000000-0000-4000-8000-000000000009',
      operation: 'update' as const,
      entityVersion: 4,
      data: { id: '00000000-0000-4000-8000-000000000009', name: 'چای', version: 4 },
    },
  ],
  nextCursor: 9,
  hasMore: false,
  mustRehydrate: false,
}
const bytes = encodePullPage(page)

const host = (answer: Record<string, unknown>) => {
  const request = jest.fn(async () => ({
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': HSB_CONTENT_TYPE },
    data: '',
    ...answer,
  }))
  return {
    request,
    adapter: createHostHttpAdapter({ request } as unknown as HisabcheBridge['http']),
  }
}
const pullConfig = {
  baseURL: 'https://api.test/api',
  url: '/sync/pull',
  params: { cursor: 0, limit: 10 },
  headers: { Accept: HSB_CONTENT_TYPE },
  responseType: 'arraybuffer',
  method: 'get',
}

describe('host HTTP adapter — binary sync pages', () => {
  it('Android: base64 over the JSON bridge becomes the exact page', async () => {
    const { request, adapter } = host({ bytesBase64: bytesToBase64(bytes) })
    const response = await adapter(pullConfig)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        responseType: 'bytes',
        url: 'https://api.test/api/sync/pull?cursor=0&limit=10',
      }),
    )
    expect(decodePullPage(new Uint8Array(response.data as ArrayBuffer))).toEqual(page)
  })

  it('desktop: bytes over IPC become the exact page', async () => {
    const { adapter } = host({ bytes })
    const response = await adapter(pullConfig)
    expect(decodePullPage(new Uint8Array(response.data as ArrayBuffer))).toEqual(page)
  })

  it('a JSON request is unchanged (parsed from text)', async () => {
    const { request, adapter } = host({
      data: '{"cursor":7}',
      headers: { 'content-type': 'application/json' },
    })
    const response = await adapter({
      baseURL: 'https://api.test/api',
      url: '/sync/cursor',
      method: 'get',
    })
    expect(response.data).toEqual({ cursor: 7 })
    expect(request).toHaveBeenCalledWith(expect.not.objectContaining({ responseType: 'bytes' }))
  })

  it('buildUrl keeps the /api segment of the base', () => {
    expect(buildUrl('https://api.test/api/', '/auth/login', undefined)).toBe(
      'https://api.test/api/auth/login',
    )
  })
})
