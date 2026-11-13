// ============================================
// backend/src/__tests__/secret-never-returned.test.ts
//
// V63 · S-3 — a secret VALUE must never reach a client.
//
// Three layers, because one is never enough:
//
//   1. behaviour — the only index→client mapping drops value-like fields;
//   2. behaviour — a rotation invalidates the cache (a stale copy would keep
//      serving a secret the owner just replaced);
//   3. source — no route file can read a value at all: the value reader
//      (`platform_secret_get` / `getSecret`) is not referenced from `routes/`.
//
// The third one is what makes this survive a future edit: a new route that
// wants to «just show the key» fails here before it ships.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { cacheService } from '../services/cache.service'
import { invalidateSecretCache, toSecretMetadata } from '../services/secrets/secret-store'

const ROUTES = join(__dirname, '..', 'routes')

function routeSources(): Array<{ file: string; source: string }> {
  return readdirSync(ROUTES)
    .filter((name) => name.endsWith('.routes.ts'))
    .map((file) => ({ file, source: readFileSync(join(ROUTES, file), 'utf8') }))
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('a secret value never reaches a client', () => {
  it('the index mapping keeps metadata and drops anything value-shaped', () => {
    const row = {
      name: 'ai.api_key',
      purpose: 'AI provider API key',
      last4: '1234',
      rotated_at: '2026-11-01T00:00:00Z',
      rotated_by: 'security@hisabche.com',
      pending_last4: null,
      pending_at: null,
      pending_by: null,
      // Deliberately smuggled in: a real row must never carry these, and if
      // one ever did, the mapping is the last line of defence.
      value: 'sk-live-SECRET',
      decrypted_secret: 'sk-live-SECRET',
    }

    const metadata = toSecretMetadata(row)
    const serialized = JSON.stringify(metadata)

    expect(serialized).not.toContain('sk-live-SECRET')
    expect(Object.keys(metadata).sort()).toEqual(
      [
        'last4',
        'name',
        'pendingAt',
        'pendingBy',
        'pendingLast4',
        'purpose',
        'rotatedAt',
        'rotatedBy',
      ].sort(),
    )
  })

  it('rotating a secret invalidates the cached value', async () => {
    const key = 'platform-secret:ai.api_key'
    await cacheService.set(key, 'sk-live-OLD', 300)
    expect(await cacheService.get<string>(key)).toBe('sk-live-OLD')

    await invalidateSecretCache('ai.api_key')

    expect(await cacheService.get<string>(key)).toBeNull()
  })

  it('no route file can read a secret value', () => {
    for (const { file, source } of routeSources()) {
      const code = stripComments(source)
      expect(code, `${file} must not call platform_secret_get`).not.toContain('platform_secret_get')
      expect(code, `${file} must not import the value reader`).not.toMatch(/\bgetSecret\b/)
      expect(code, `${file} must not import decrypted_secrets`).not.toContain('decrypted_secrets')
    }
  })

  it('the secrets route exposes only list and stage', () => {
    const code = stripComments(readFileSync(join(ROUTES, 'admin-secrets.routes.ts'), 'utf8'))
    expect(code).toContain('listSecrets')
    expect(code).toContain('stageSecret')
    expect(code).not.toContain('promoteStagedSecret')
    expect(code).not.toMatch(/secret_get|decrypted/)
  })

  it('the AI config route serialises the status shape, never the config', () => {
    const code = stripComments(readFileSync(join(ROUTES, 'ai-chat.routes.ts'), 'utf8'))
    // `getConfig()` carries the key; `getStatus()` does not. The GET route is
    // the only place either is read for a response.
    expect(code).toMatch(/GET|fastify\.get\(\s*'\/api\/ai\/config'/s)
    expect(code).toContain('settings.getStatus()')
    expect(code).not.toMatch(/reply\.send\(\s*await settings\.getConfig\(\)/)
  })

  it('the migration index has no column that could hold a value', () => {
    const sql = readFileSync(
      join(__dirname, '../../../docs/admin-secrets-01-migration.sql'),
      'utf8',
    )
    const table = sql.slice(
      sql.indexOf('CREATE TABLE IF NOT EXISTS public.platform_secrets'),
      sql.indexOf('CREATE INDEX IF NOT EXISTS idx_platform_secrets_purpose'),
    )
    expect(table).toContain('vault_secret_id')
    expect(table).not.toMatch(/\bvalue\b|api_key\b|secret TEXT/i)
  })
})
