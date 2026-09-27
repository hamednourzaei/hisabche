// ============================================
// Per-member page blocks — which modules one person may NOT use.
//
// Read on every request by requireWorkspaceContext, so it is cached per
// workspace like role capabilities (60s, invalidated on every write). Before
// docs/member-module-blocks-migration.sql has run the table does not exist:
// that reads as "no blocks", never as a 500.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import { BLOCKABLE_MODULES, type WorkspaceRole } from './authorization.domain'

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205')
}

type BlocksByUser = Record<string, string[]>

/**
 * Stored module keys → the blocks enforced. A key the server no longer knows
 * is ignored, not enforced as nothing. Shared with resolveWorkspaceAccess.
 */
export function parseBlocks(keys: readonly unknown[]): string[] {
  return keys.filter((k): k is string => typeof k === 'string' && BLOCKABLE_MODULES.includes(k))
}

export class MemberModuleBlocksService {
  private key(workspaceId: string) {
    return `permissions:${workspaceId}:member-module-blocks`
  }

  /** Every member's blocks in one workspace, keyed by user id. */
  async all(workspaceId: string): Promise<BlocksByUser> {
    const cached = await memoryCache.getShared<BlocksByUser>(this.key(workspaceId))
    if (cached) return cached

    const { data, error } = await supabase
      .from('workspace_member_module_blocks')
      .select('user_id, module_key')
      .eq('workspace_id', workspaceId)

    if (error && isMissingTable(error)) return {}
    if (error) throw new DatabaseError('Failed to read member page blocks', error)

    const byUser: BlocksByUser = {}
    for (const row of (data ?? []) as Array<{ user_id: string; module_key: string }>) {
      if (parseBlocks([row.module_key]).length === 0) continue
      ;(byUser[row.user_id] ??= []).push(row.module_key)
    }

    await memoryCache.setShared(this.key(workspaceId), byUser, 60)
    return byUser
  }

  async forMember(workspaceId: string, userId: string): Promise<string[]> {
    return (await this.all(workspaceId))[userId] ?? []
  }

  /**
   * Replace one member's blocks. Only the owner may, and never on the owner:
   * a block there would be ignored anyway, and storing it would make the
   * screen claim a restriction that does not exist.
   */
  async setForMember(
    actor: { workspaceId: string; userId: string; role: WorkspaceRole },
    targetUserId: string,
    modules: readonly string[],
  ): Promise<string[]> {
    if (actor.role !== 'owner') {
      throw new ValidationError('MEMBER_BLOCKS_FORBIDDEN: only the owner may change page access.')
    }

    const unknown = modules.filter((m) => !BLOCKABLE_MODULES.includes(m))
    if (unknown.length > 0)
      throw new ValidationError(`MEMBER_BLOCKS_UNKNOWN_MODULE: ${unknown.join(', ')}`)

    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', actor.workspaceId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (memberError) throw new DatabaseError('Failed to verify the member', memberError)
    if (!member) throw new ValidationError('MEMBER_BLOCKS_NOT_A_MEMBER')
    if ((member as { role?: string }).role === 'owner') {
      throw new ValidationError('MEMBER_BLOCKS_OWNER: the owner cannot be restricted.')
    }

    const wanted = [...new Set(modules)]

    const { error: deleteError } = await supabase
      .from('workspace_member_module_blocks')
      .delete()
      .eq('workspace_id', actor.workspaceId)
      .eq('user_id', targetUserId)
    if (deleteError && isMissingTable(deleteError)) {
      throw new ValidationError(
        'MEMBER_BLOCKS_NOT_CONFIGURED: run docs/member-module-blocks-migration.sql',
      )
    }
    if (deleteError) throw new DatabaseError('Failed to clear page blocks', deleteError)

    if (wanted.length > 0) {
      const { error: insertError } = await supabase.from('workspace_member_module_blocks').insert(
        wanted.map((module_key) => ({
          workspace_id: actor.workspaceId,
          user_id: targetUserId,
          module_key,
          created_by: actor.userId,
        })),
      )
      if (insertError) throw new DatabaseError('Failed to save page blocks', insertError)
    }

    await memoryCache.invalidate(this.key(actor.workspaceId))
    return wanted
  }
}

export const memberModuleBlocks = new MemberModuleBlocksService()
