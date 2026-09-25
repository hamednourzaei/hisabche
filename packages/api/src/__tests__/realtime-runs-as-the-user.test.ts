// ============================================
// ⚠️ REALTIME MUST JOIN AS THE SIGNED-IN USER, NOT AS `anon`.
//
// Sign-in goes through the backend, so the shared Supabase client never had a
// session and every channel joined with the anon key. Realtime delivers a row
// only if the subscriber's RLS policy allows it, and anon is allowed nothing:
// one employee's invoice never reached another's open dashboard, with every
// subscription reporting SUBSCRIBED.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const packages = join(__dirname, '..', '..', '..')
const read = (path: string) => strip(readFileSync(join(packages, path), 'utf8'))

describe('realtime runs as the user', () => {
  it('the client takes its token from the app, on every ask', () => {
    expect(read('auth/src/supabase.ts')).toContain(
      'accessToken: async () => tokenSource?.() ?? null',
    )
  })

  it('the app registers the token source before any realtime user gets the client', () => {
    expect(read('api/src/supabase/client.ts')).toContain('setSupabaseTokenSource(')
    for (const file of [
      'supabase/realtime.ts',
      'supabase/presence.ts',
      'hooks/useRealtimeActivities.ts',
    ]) {
      const source = read(`api/src/${file}`)
      expect(source, file).toMatch(
        /import \{[^}]*supabaseClient[^}]*\} from '\.\.?\/(supabase\/)?client'/,
      )
      expect(source, file).not.toContain("from '@hisabche/auth'")
      expect(source, file).not.toContain('auth/src/supabase')
    }
  })
})
