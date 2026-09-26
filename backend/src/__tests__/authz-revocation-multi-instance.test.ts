// ============================================
// A revocation on instance A is enforced by instance B immediately — not after
// B's local cache expires.
//
// Two "instances" = the same modules loaded twice (vi.resetModules), so each
// has its OWN in-process L1, exactly as two Node processes would. They share
// one fake Redis and one fake database, as two Render instances share the real
// ones.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Shared infrastructure ─────────────────────────────────────────────────
const redis = new Map<string, string>()
let redisUp = true
const db = { blocks: [] as Array<{ user_id: string; module_key: string }> }

vi.mock('../services/cache.service', () => ({
  cacheService: {
    get isShared() {
      return redisUp
    },
    async get(key: string) {
      const v = redis.get(key)
      return v ? JSON.parse(v) : null
    },
    async set(key: string, value: unknown) {
      redis.set(key, JSON.stringify(value))
      return true
    },
    async delPattern(pattern: string) {
      const prefix = pattern.replace(/\*$/, '')
      for (const k of [...redis.keys()]) if (k.startsWith(prefix)) redis.delete(k)
      return 1
    },
    async flush() {
      redis.clear()
    },
  },
}))

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'workspace_member_module_blocks') {
        return {
          select: () => ({ eq: async () => ({ data: [...db.blocks], error: null }) }),
          delete: () => ({
            eq: () => ({
              eq: async (_c: string, userId: string) => {
                db.blocks = db.blocks.filter((b) => b.user_id !== userId)
                return { error: null }
              },
            }),
          }),
          insert: async (rows: Array<{ user_id: string; module_key: string }>) => {
            db.blocks.push(...rows.map((r) => ({ user_id: r.user_id, module_key: r.module_key })))
            return { error: null }
          },
        }
      }
      // workspace_members: the target is a member, not the owner.
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { user_id: 'u1', role: 'seller' }, error: null }),
            }),
          }),
        }),
      }
    },
  },
}))

async function bootInstance() {
  vi.resetModules()
  const { MemberModuleBlocksService } =
    await import('../services/authorization/member-module-blocks.service')
  const { memoryCache } = await import('../utils/pagination')
  return { blocks: new MemberModuleBlocksService(), memoryCache }
}

const OWNER = { workspaceId: 'ws1', userId: 'owner', role: 'owner' as const }

beforeEach(() => {
  redis.clear()
  redisUp = true
  db.blocks = []
})

describe('⚠️ revoking a page on instance A is enforced on instance B at once', () => {
  it('Redis up: B sees the new block on its very next request', async () => {
    const a = await bootInstance()
    const b = await bootInstance()

    // B authorizes u1 and caches the (empty) block list.
    expect(await b.blocks.forMember('ws1', 'u1')).toEqual([])

    // The owner, on A, takes invoices away from u1.
    await a.blocks.setForMember(OWNER, 'u1', ['invoices'])

    // B's next request: no local copy can outlive the revocation.
    expect(await b.blocks.forMember('ws1', 'u1')).toEqual(['invoices'])
  })

  it('Redis down: nothing is cached in-process, so B still reads the truth', async () => {
    redisUp = false
    const a = await bootInstance()
    const b = await bootInstance()
    expect(await b.blocks.forMember('ws1', 'u1')).toEqual([])
    await a.blocks.setForMember(OWNER, 'u1', ['accounting'])
    expect(await b.blocks.forMember('ws1', 'u1')).toEqual(['accounting'])
  })

  it('(the bug this closes) the ordinary L1 path WOULD have kept serving the stale answer on B', async () => {
    const a = await bootInstance()
    const b = await bootInstance()
    await b.memoryCache.set('probe', { blocks: [] }, 60)
    await a.memoryCache.invalidate('probe')
    // A cleared Redis and its own L1 — B's L1 still answers from memory.
    expect(await b.memoryCache.get('probe')).toEqual({ blocks: [] })
    // The authorization path does not consult L1 at all.
    expect(await b.memoryCache.getShared('probe')).toBeNull()
  })
})

describe('every access-deciding cache uses the shared-only path', () => {
  it.each([
    'services/authorization/role-capabilities.service.ts',
    'services/authorization/member-module-blocks.service.ts',
    'middleware/auth.middleware.ts',
  ])('%s', async (file) => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', file), 'utf8')
    if (file.includes('auth.middleware')) {
      // Only the session-revocation epoch here decides access across instances.
      expect(src).toContain('memoryCache.getShared<{ at: number | null }>(cacheKey)')
      expect(src).toContain('memoryCache.setShared(cacheKey, { at }, SESSION_EPOCH_TTL_SECONDS)')
    } else {
      expect(src).toContain('memoryCache.getShared<')
      expect(src).toContain('memoryCache.setShared(')
      expect(src).not.toMatch(/memoryCache\.(get|set)</)
    }
  })
})
