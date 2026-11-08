// ============================================
// WorkspaceService.createWorkspace — one transaction (workspace-create-01).
//
// The workspace and its owner's membership are written by ONE Postgres
// function. Since 8 Nov 2026 (VERIFY all true on the live database) there is
// no two-step fallback: every database failure, the function missing
// included, is a failure that writes nothing. The database
// side of the rule (both rows or neither) is held by
// workspace-create-01.pg.test.ts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type DbError = { code?: string; message?: string } | null

const state: {
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>
  rpcResult: { data: unknown; error: DbError }
  inserts: Array<{ table: string; row: Record<string, unknown> }>
} = { rpcCalls: [], rpcResult: { data: null, error: null }, inserts: [] }

const WS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OWNER = '11111111-1111-4111-8111-111111111111'

function chain(table: string) {
  const self: Record<string, unknown> = {}
  const resolveRow = () => ({ data: { id: WS_ID, name: 'دکان', owner_id: OWNER }, error: null })
  self.select = () => self
  self.eq = () => self
  self.single = () => Promise.resolve(resolveRow())
  self.insert = (row: Record<string, unknown>) => {
    state.inserts.push({ table, row })
    // workspace_members insert is awaited directly: { error }
    const result = { data: null, error: null }
    return Object.assign(Promise.resolve(result), self)
  }
  return self
}

vi.mock('../db', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, args })
      return Promise.resolve(state.rpcResult)
    },
    from: (table: string) => chain(table),
  },
}))

const { WorkspaceService } = await import('../services/workspace.service')

beforeEach(() => {
  state.rpcCalls = []
  state.inserts = []
  state.rpcResult = { data: WS_ID, error: null }
})

describe('createWorkspace — atomic', () => {
  it('creates through workspace_create_with_owner and writes nothing else', async () => {
    const ws = await new WorkspaceService().createWorkspace(OWNER, {
      name: 'دکان نمونه',
      isActive: true,
      baseCurrency: 'USD',
    } as never)
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.rpcCalls[0]!.fn).toBe('workspace_create_with_owner')
    expect(state.rpcCalls[0]!.args).toMatchObject({
      p_owner: OWNER,
      p_name: 'دکان نمونه',
      p_base_currency: 'USD',
    })
    // No separate insert into either table — the function wrote both rows.
    expect(state.inserts).toEqual([])
    expect(ws).toMatchObject({ id: WS_ID })
  })

  it('the function missing is a failure too — no two-step write any more', async () => {
    state.rpcResult = {
      data: null,
      error: {
        code: 'PGRST202',
        message:
          'Could not find the function public.workspace_create_with_owner in the schema cache',
      },
    }
    await expect(
      new WorkspaceService().createWorkspace(OWNER, { name: 'x', isActive: true } as never),
    ).rejects.toThrow('Failed to create workspace')
    expect(state.inserts).toEqual([])
  })

  it('the service source has no two-step path left', () => {
    const service = readFileSync(join(SRC, 'services', 'workspace.service.ts'), 'utf8')
    expect(service).not.toContain('createWorkspaceInTwoSteps')
    expect(service).not.toContain('WORKSPACE_ATOMIC_RPC_MISSING')
  })

  it('a missing function raised from INSIDE the body is a failure, not a fallback', async () => {
    state.rpcResult = {
      data: null,
      error: { code: '42883', message: 'function gen_random_uuid() does not exist' },
    }
    await expect(
      new WorkspaceService().createWorkspace(OWNER, { name: 'x', isActive: true } as never),
    ).rejects.toThrow('Failed to create workspace')
    expect(state.inserts).toEqual([])
  })

  it('any other database refusal is a failure and writes nothing', async () => {
    state.rpcResult = { data: null, error: { code: '23502', message: 'MEMBER_INSERT_REFUSED' } }
    await expect(
      new WorkspaceService().createWorkspace(OWNER, { name: 'x', isActive: true } as never),
    ).rejects.toThrow('Failed to create workspace')
    expect(state.inserts).toEqual([])
  })
})

// ─── Source guards for the rest of the P0 round ─────────────────────────────

const SRC = join(__dirname, '..')
const stripComments = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

describe('signup and email — P0 guards', () => {
  it('the signup route reads the result of the profile write', () => {
    const route = stripComments(readFileSync(join(SRC, 'routes', 'auth.routes.ts'), 'utf8'))
    expect(route).toContain(
      "const { error: profileError } = await supabase.from('profiles').upsert(",
    )
    expect(route).toContain('SIGNUP_PROFILE_NOT_WRITTEN')
    expect(route).toContain('SIGNUP_WORKSPACE_NOT_PROVISIONED')
  })

  it('nothing derived from RESEND_API_KEY is logged', () => {
    const email = stripComments(readFileSync(join(SRC, 'services', 'email.service.ts'), 'utf8'))
    const logLines = email.split('\n').filter((line) => /console\.(log|info|warn|error)/.test(line))
    for (const line of logLines) {
      expect(line).not.toMatch(/RESEND_API_KEY[^?]*\.(substring|slice|length)/)
      expect(line).not.toContain('API_KEY prefix')
    }
  })
})
