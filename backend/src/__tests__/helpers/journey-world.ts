// ============================================
// backend/src/__tests__/helpers/journey-world.ts
//
// The `src/db.ts` module the journeys run the app against: the services' supabase-js
// calls go WRITE-THROUGH to a real PostgreSQL (pg-mirror.ts), and Supabase AUTH — an
// external service (GoTrue) — is a small stand-in that keeps its users in memory and
// mirrors each one into the real `auth.users`.
//
// The stand-in implements only what the backend calls: admin.createUser,
// admin.getUserById, signInWithPassword, refreshSession, getUser, signOut. A token is
// JWT-SHAPED (header.payload.signature) because the auth middleware reads its `exp`;
// it is checked by lookup, never by a signature, and means nothing outside this process.
//
// Storage answers «not available» rather than pretending to store a file.
// ============================================

import { randomBytes, randomUUID } from 'node:crypto'
import { FakeDatabase, createFakeDb, type Row } from './fake-supabase'
import { createPgMirror, syncInto, type PgRunner } from './pg-mirror'

interface AuthUser {
  id: string
  email: string
  password: string
  user_metadata: Row
  created_at: string
}

const base64url = (value: string) => Buffer.from(value).toString('base64url')

function jwtShaped(sub: string, seconds: number): { token: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + seconds
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({ sub, exp: expiresAt, role: 'authenticated', jti: randomUUID() }),
  )
  return { token: `${header}.${payload}.${randomBytes(16).toString('base64url')}`, expiresAt }
}

export interface JourneyWorld {
  db: FakeDatabase
  /** What `src/db.ts` exports, backed by the world. */
  dbModule: Record<string, unknown>
  /** Every refusal of the REAL database, newest last. */
  realErrors: string[]
}

export async function createJourneyWorld(runner: PgRunner): Promise<JourneyWorld> {
  const db = new FakeDatabase()
  const realErrors: string[] = []
  const mirror = createPgMirror(runner, () => syncInto(runner, db))
  db.mirror = {
    write: async (change) => {
      const error = await mirror.write(change)
      if (error) realErrors.push(`${change.kind} ${change.table}: ${error.message}`)
      return error
    },
    rpc: async (name, args) => {
      const result = await mirror.rpc(name, args)
      if (result.error) realErrors.push(`rpc ${name}: ${result.error.message}`)
      return result
    },
  }
  await syncInto(runner, db)

  const byId = new Map<string, AuthUser>()
  const byEmail = new Map<string, AuthUser>()
  const accessTokens = new Map<string, string>()
  const refreshTokens = new Map<string, string>()

  const publicUser = (user: AuthUser) => ({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
    app_metadata: {},
    aud: 'authenticated',
    created_at: user.created_at,
  })

  function session(user: AuthUser) {
    const access = jwtShaped(user.id, 3600)
    const refresh = randomBytes(24).toString('base64url')
    accessTokens.set(access.token, user.id)
    refreshTokens.set(refresh, user.id)
    return {
      access_token: access.token,
      refresh_token: refresh,
      expires_at: access.expiresAt,
      expires_in: 3600,
      token_type: 'bearer',
      user: publicUser(user),
    }
  }

  const auth = {
    getUser: async (token: string) => {
      const id = accessTokens.get(token)
      const user = id ? byId.get(id) : undefined
      return user
        ? { data: { user: publicUser(user) }, error: null }
        : { data: { user: null }, error: { message: 'invalid token', status: 401 } }
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const user = byEmail.get(email.toLowerCase())
      if (!user || user.password !== password) {
        return {
          data: { session: null, user: null },
          error: { message: 'Invalid login credentials', status: 400 },
        }
      }
      const opened = session(user)
      return { data: { session: opened, user: opened.user }, error: null }
    },
    refreshSession: async ({ refresh_token }: { refresh_token: string }) => {
      const id = refreshTokens.get(refresh_token)
      const user = id ? byId.get(id) : undefined
      if (!user)
        return { data: { session: null, user: null }, error: { message: 'invalid refresh token' } }
      refreshTokens.delete(refresh_token)
      const opened = session(user)
      return { data: { session: opened, user: opened.user }, error: null }
    },
    signOut: async () => ({ error: null }),
    admin: {
      createUser: async (input: { email: string; password: string; user_metadata?: Row }) => {
        const email = input.email.toLowerCase()
        if (byEmail.has(email)) {
          return {
            data: { user: null },
            error: { message: 'A user with this email address has already been registered' },
          }
        }
        const user: AuthUser = {
          id: randomUUID(),
          email,
          password: input.password,
          user_metadata: input.user_metadata ?? {},
          created_at: new Date().toISOString(),
        }
        // The real auth.users row, so anything that joins to it finds the person.
        await runner.query(
          'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3::jsonb)',
          [user.id, user.email, JSON.stringify(user.user_metadata)],
        )
        byId.set(user.id, user)
        byEmail.set(email, user)
        return { data: { user: publicUser(user) }, error: null }
      },
      getUserById: async (id: string) => {
        const user = byId.get(id)
        return user
          ? { data: { user: publicUser(user) }, error: null }
          : { data: { user: null }, error: { message: 'User not found', status: 404 } }
      },
      updateUserById: async (id: string, changes: { password?: string; user_metadata?: Row }) => {
        const user = byId.get(id)
        if (!user) return { data: { user: null }, error: { message: 'User not found' } }
        if (changes.password) user.password = changes.password
        if (changes.user_metadata)
          user.user_metadata = { ...user.user_metadata, ...changes.user_metadata }
        return { data: { user: publicUser(user) }, error: null }
      },
      signOut: async () => ({ error: null }),
    },
  }

  const unavailable = { message: 'storage is not available in the journey world' }
  const storage = {
    listBuckets: async () => ({ data: [], error: null }),
    createBucket: async () => ({ data: null, error: unavailable }),
    from: () => ({
      upload: async () => ({ data: null, error: unavailable }),
      remove: async () => ({ data: null, error: unavailable }),
      createSignedUrl: async () => ({ data: null, error: unavailable }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      list: async () => ({ data: [], error: null }),
    }),
  }

  const base = createFakeDb(db, new Map())
  const supabase = { ...base.supabase, auth, storage }
  const dbModule: Record<string, unknown> = {
    ...base,
    supabase,
    default: supabase,
    createAuthClient: () => ({ auth }),
    createUserScopedClient: () => supabase,
    gotrueRequest: async () => ({
      data: null,
      error: { message: 'gotrue is not available in the journey world' },
    }),
  }
  return { db, dbModule, realErrors }
}
