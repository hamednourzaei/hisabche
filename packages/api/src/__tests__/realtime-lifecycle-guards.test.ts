import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    ;(globalThis as { window?: unknown }).window = globalThis
  }
})

interface FakePresenceChannel {
  name: string
  statusCb?: (status: string) => void
  untrackCount: number
  removed: boolean
}

const presenceChannels: FakePresenceChannel[] = []
let activeToken: string | null = 'user-jwt'
let tokenSource: (() => string | null) | null = null

vi.mock('../../../auth/src/supabase', () => ({
  supabaseClient: {
    channel(name: string) {
      const ch: FakePresenceChannel & {
        on: () => typeof ch
        subscribe: (cb?: (status: string) => void) => typeof ch
        track: () => Promise<'ok'>
        untrack: () => Promise<'ok'>
        presenceState: () => Record<string, unknown[]>
      } = {
        name,
        untrackCount: 0,
        removed: false,
        on() {
          return ch
        },
        subscribe(cb?: (status: string) => void) {
          if (cb) ch.statusCb = cb
          return ch
        },
        track() {
          return Promise.resolve('ok')
        },
        untrack() {
          ch.untrackCount++
          return Promise.resolve('ok')
        },
        presenceState() {
          return {}
        },
      }
      presenceChannels.push(ch)
      return ch
    },
    removeChannel(ch: FakePresenceChannel) {
      ch.removed = true
      return Promise.resolve('ok')
    },
  },
  setSupabaseTokenSource(src: () => string | null) {
    tokenSource = src
  },
}))

const { registerTokenGetter } = await import('../lib/tokenProvider')
registerTokenGetter(() => activeToken)

const { subscribeToPresence } = await import('../supabase/presence')

describe('realtime & presence lifecycle hygiene', () => {
  it('skips untrack when unsubscribing before SUBSCRIBED, and closes presence on sign-out', () => {
    const first = subscribeToPresence('ws-1', { userId: 'u-1', name: 'Hamed' }, () => {})
    expect(presenceChannels).toHaveLength(1)
    first.unsubscribe()
    expect(presenceChannels[0]!.removed).toBe(true)
    expect(presenceChannels[0]!.untrackCount).toBe(0)

    const second = subscribeToPresence('ws-2', { userId: 'u-1', name: 'Hamed' }, () => {})
    expect(presenceChannels).toHaveLength(2)
    presenceChannels[1]!.statusCb?.('SUBSCRIBED')

    // Token vanishes -> sign-out listener closes presence cleanly and calls untrack
    activeToken = null
    expect(tokenSource?.()).toBeNull()
    expect(presenceChannels[1]!.removed).toBe(true)
    expect(presenceChannels[1]!.untrackCount).toBe(1)

    // Idempotent cleanup stays safe
    expect(() => second.unsubscribe()).not.toThrow()
  })

  it('realtime and presence hooks gate on token availability and defer subscription past StrictMode ticks', () => {
    const realtimeHook = readFileSync(join(__dirname, '..', 'hooks', 'useRealtime.ts'), 'utf8')
    const presenceHook = readFileSync(join(__dirname, '..', 'hooks', 'usePresence.ts'), 'utf8')
    const supabaseMod = readFileSync(join(__dirname, '../../../auth/src/supabase.ts'), 'utf8')

    expect(realtimeHook).toContain('isOfflineTokenMode() || !hasToken()')
    expect(realtimeHook).toContain('clearTimeout(timer)')
    expect(presenceHook).toContain('isOfflineTokenMode() || !hasToken()')
    expect(presenceHook).toContain('clearTimeout(timer)')
    // Next.js/Turbopack requires direct process.env.NEXT_PUBLIC_* member access for static inlining
    expect(supabaseMod).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL')
    expect(supabaseMod).toContain('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
  })
})
