// ============================================
// Reported 26 Sep 2026: a free OpenRouter model configured in the admin
// panel, «سلام» in the assistant → 400. The admin had entered the base URL as
// OpenRouter documents it — the whole endpoint — and the service appended
// `/v1/chat/completions` again. The provider's own error body was thrown
// away, so nothing said why.
// ============================================

import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: {} }))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { AiChatService, providerEndpoint } = await import('../services/ai/ai-chat.service')

describe('providerEndpoint accepts every way a base URL is written', () => {
  it.each([
    // The exact value from the report.
    [
      'https://openrouter.ai/api/v1/chat/completions',
      'https://openrouter.ai/api/v1/chat/completions',
    ],
    ['https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1/chat/completions'],
    ['https://openrouter.ai/api/v1/', 'https://openrouter.ai/api/v1/chat/completions'],
    ['https://api.openai.com', 'https://api.openai.com/v1/chat/completions'],
    ['  https://api.openai.com/  ', 'https://api.openai.com/v1/chat/completions'],
  ])('openai-compatible: %s', (base, expected) => {
    expect(providerEndpoint('openai', base)).toBe(expected)
  })

  it.each([
    [null, 'https://api.anthropic.com/v1/messages'],
    ['https://api.anthropic.com', 'https://api.anthropic.com/v1/messages'],
    ['https://api.anthropic.com/v1', 'https://api.anthropic.com/v1/messages'],
    ['https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1/messages'],
  ])('anthropic: %s', (base, expected) => {
    expect(providerEndpoint('anthropic', base)).toBe(expected)
  })

  it("no base URL: each provider's own default", () => {
    expect(providerEndpoint('openai', null)).toBe('https://api.openai.com/v1/chat/completions')
    expect(providerEndpoint('openai', '')).toBe('https://api.openai.com/v1/chat/completions')
  })
})

describe('testConnection (the admin «test» button)', () => {
  const config = {
    provider: 'openai' as const,
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'poolside/laguna-s-2.1:free',
    apiKey: 'sk-test',
    systemPrompt: '',
    topupContact: '',
    isEnabled: true,
  }
  afterEach(() => vi.unstubAllGlobals())

  it('success: ok, and the request went to the right URL with the key as a bearer token', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), {
          status: 200,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const result = await new AiChatService().testConnection(config)
    expect(result).toMatchObject({ ok: true, status: 200, detail: 'OK' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test')
  })

  it("failure: the provider's OWN message reaches the admin, not just a status", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{"error":{"message":"No endpoints found for model"}}', { status: 404 }),
      ),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await new AiChatService().testConnection(config)
    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(result.detail).toContain('No endpoints found for model')
  })

  it('unreachable: ok false, status null, a reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const result = await new AiChatService().testConnection(config)
    expect(result).toMatchObject({ ok: false, status: null })
    expect(result.detail).toContain('fetch failed')
  })
})
