// ============================================
// backend/src/services/developer/sandbox.service.ts
//
// Sandbox workspaces (docs/developer-platform-06-sandbox-migration.sql).
//
// A sandbox IS a workspace — flagged, empty, owned by the person who asked for
// it. Every existing boundary (RLS, keys, webhooks, OAuth) isolates it because
// it has its own workspace_id; this service only creates it and says which
// side of the line the active workspace is on.
// ============================================

import type { SandboxErrorCode } from '@hisabche/validation'

import { supabase } from '../../db'
import { isMissingSchema } from '../blog/blog.domain'
import type { TenancyContext } from '../tenancy.service'
import { WorkspaceService } from '../workspace.service'
import { NotConfiguredError } from './developer.repository'

export class SandboxError extends Error {
  constructor(
    readonly code: SandboxErrorCode,
    readonly statusCode: number,
  ) {
    super(code)
    this.name = 'SandboxError'
  }
}

/** The database's refusals, by the code it raised (create_sandbox_workspace). */
const REFUSALS: Array<[SandboxErrorCode, number]> = [
  ['SANDBOX_OF_SANDBOX', 409],
  ['SANDBOX_NOT_MEMBER', 403],
  ['SANDBOX_PARENT_NOT_FOUND', 404],
]

function check(error: { code?: string; message?: string } | null): void {
  if (!error) return
  if (isMissingSchema(error)) throw new NotConfiguredError()
  const refusal = REFUSALS.find(([code]) => error.message?.includes(code))
  if (refusal) throw new SandboxError(refusal[0], refusal[1])
  throw Object.assign(new Error(error.message ?? 'database error'), { code: error.code })
}

export interface SandboxStatus {
  /** The active workspace is a sandbox. */
  isSandbox: boolean
  /** When it is: the real business it belongs to — only if this person is still a member of it. */
  parent: { id: string; name: string } | null
  /** When it is not: this person's sandbox of it, if they made one. */
  sandbox: { id: string; name: string } | null
}

export function createSandboxService(
  workspaces: Pick<WorkspaceService, 'invalidateUserCache'> = new WorkspaceService(),
) {
  async function current(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, is_sandbox, sandbox_of')
      .eq('id', ctx.workspaceId)
      .maybeSingle()
    check(error)
    return data as { id: string; is_sandbox: boolean; sandbox_of: string | null } | null
  }

  return {
    async status(ctx: TenancyContext): Promise<SandboxStatus> {
      const ws = await current(ctx)
      if (ws?.is_sandbox) {
        if (!ws.sandbox_of) return { isSandbox: true, parent: null, sandbox: null }
        const [{ data: member, error: memberError }, { data: parent, error: parentError }] =
          await Promise.all([
            supabase
              .from('workspace_members')
              .select('user_id')
              .eq('workspace_id', ws.sandbox_of)
              .eq('user_id', ctx.userId)
              .maybeSingle(),
            supabase.from('workspaces').select('id, name').eq('id', ws.sandbox_of).maybeSingle(),
          ])
        check(memberError)
        check(parentError)
        return {
          isSandbox: true,
          parent: member && parent ? (parent as { id: string; name: string }) : null,
          sandbox: null,
        }
      }
      const { data: own, error } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('sandbox_of', ctx.workspaceId)
        .eq('owner_id', ctx.userId)
        .maybeSingle()
      check(error)
      return {
        isSandbox: false,
        parent: null,
        sandbox: (own as { id: string; name: string } | null) ?? null,
      }
    },

    /** This person's sandbox of the active workspace — created on first call, returned after. */
    async create(ctx: TenancyContext): Promise<{ id: string; name: string; created: boolean }> {
      const { data, error } = await supabase.rpc('create_sandbox_workspace', {
        p_parent: ctx.workspaceId,
        p_user: ctx.userId,
      })
      check(error)
      const row = ((data ?? []) as Array<{ id: string; name: string; created: boolean }>)[0]
      if (!row) throw new Error('create_sandbox_workspace returned no row')
      // The workspace list is cached per user; the new one must be in it now.
      if (row.created) await workspaces.invalidateUserCache(ctx.userId)
      return row
    },
  }
}

export const sandboxService = createSandboxService()
export type SandboxService = ReturnType<typeof createSandboxService>
