// ============================================
// backend/src/services/inventory/warehouse-access.ts
//
// Which warehouses a member may sell from, and where every warehouse is.
//
// There is no second permission system here. A warehouse belongs to a branch
// (`warehouses.branch_id`), and a member's branches are already decided by
// their branch assignments (`branches.scopeFor`). So:
//
//   · a member with every branch            → every warehouse
//   · a member limited to some branches     → the warehouses of those branches
//   · a warehouse that belongs to no branch → every member, until it is given one
//
// ⚠️ THE LAST LINE IS DELIBERATE. Before this rule existed no warehouse had a
// branch. Reading «no branch» as «nobody limited may use it» would have locked
// every branch-limited seller out of every warehouse the day it shipped. A
// warehouse is restricted by PLACING it in a branch — an act, not a default.
//
// ⚠️ `branch_id` ON WAREHOUSES COMES FROM docs/branch-migration.sql. On a
// database without it nothing can be restricted, and that is SAID
// (`branchesConfigured: false`) — it is not silently treated as «allowed».
//
// This module imports the branch service and the database, and nothing that
// imports it back (invoice.service and warehouse.service both read it).
// ============================================

import { supabase } from '../../db'
import { ForbiddenError } from '../../errors/auth.error'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { branches } from '../branch'
import { mayUseBranch, type BranchScope } from '../branch/branch.domain'
import type { TenancyContext } from '../tenancy.service'

const MISSING_COLUMN = new Set(['42703', 'PGRST204'])

export interface PlacedWarehouse {
  id: string
  name: string
  /** The branch this warehouse belongs to. Null = the business as a whole. */
  branchId: string | null
  branchName: string | null
}

export interface StockPlacement {
  /** False = this database cannot say which branch a warehouse belongs to. */
  branchesConfigured: boolean
  /** True = the list is only what this member's branches include. */
  restricted: boolean
  warehouses: PlacedWarehouse[]
  /** One row per product and warehouse that holds a record of it. */
  stock: Array<{ productId: string; warehouseId: string; quantity: number }>
}

/** Pure: may a member with this scope use a warehouse of this branch? */
export function mayUseWarehouse(
  scope: BranchScope,
  warehouseBranchId: string | null,
  branchesConfigured: boolean,
): boolean {
  // Nothing to restrict by. Saying «no» here would lock every seller out of a
  // database that simply has not run the branch migration.
  if (!branchesConfigured) return scope.kind !== 'none'
  // Not placed in any branch: not restricted to one.
  if (warehouseBranchId === null) return scope.kind !== 'none'
  return mayUseBranch(scope, warehouseBranchId)
}

/** Each live warehouse's branch — or null when the column is not there. */
async function readWarehouseBranches(
  workspaceId: string,
): Promise<Map<string, string | null> | null> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, branch_id')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
  if (error) {
    if (MISSING_COLUMN.has(error.code ?? '')) return null
    throw new DatabaseError('Failed to read the branches of warehouses', error)
  }
  return new Map(
    ((data ?? []) as Array<{ id: string; branch_id: string | null }>).map((row) => [
      row.id,
      row.branch_id ?? null,
    ]),
  )
}

/** The warehouses this member may use, each with its branch, and what they hold. */
export async function stockPlacement(ctx: TenancyContext): Promise<StockPlacement> {
  const [scope, known, branchOf, live] = await Promise.all([
    branches.scopeFor(ctx),
    branches.list(ctx),
    readWarehouseBranches(ctx.workspaceId),
    supabase
      .from('warehouses')
      .select('id, name, is_active')
      .eq('workspace_id', ctx.workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ])
  if (live.error) throw new DatabaseError('Failed to read warehouses', live.error)

  const branchName = new Map(known.map((branch) => [branch.id, branch.name]))
  const branchesConfigured = branchOf !== null
  const warehouses: PlacedWarehouse[] = (
    (live.data ?? []) as Array<{ id: string; name: string; is_active: boolean | null }>
  )
    .filter((row) => row.is_active !== false)
    .map((row) => {
      const branchId = branchOf?.get(row.id) ?? null
      return {
        id: row.id,
        name: row.name,
        branchId,
        branchName: branchId ? (branchName.get(branchId) ?? null) : null,
      }
    })
    .filter((row) => mayUseWarehouse(scope, row.branchId, branchesConfigured))

  const allowed = new Set(warehouses.map((row) => row.id))
  const stock = await selectAllPages<
    { warehouse_id: string; product_id: string; quantity: number | string | null },
    { message: string; code?: string }
  >((from, to) =>
    supabase
      .from('warehouse_stock')
      .select('warehouse_id, product_id, quantity')
      .eq('workspace_id', ctx.workspaceId)
      .order('warehouse_id', { ascending: true })
      .order('product_id', { ascending: true })
      .range(from, to),
  )
  if (stock.error) throw new DatabaseError('Failed to read warehouse stock', stock.error)

  return {
    branchesConfigured,
    restricted: branchesConfigured && scope.kind !== 'all',
    warehouses,
    stock: (stock.data ?? [])
      .filter((row) => allowed.has(row.warehouse_id))
      .map((row) => ({
        productId: row.product_id,
        warehouseId: row.warehouse_id,
        quantity: Number(row.quantity) || 0,
      })),
  }
}

/**
 * A warehouse named on a sale or a purchase must be one this member may use.
 * (That it exists and is this workspace's is checked by the caller.)
 *
 * `errorCode` exists because a refusal is read by a person on the screen that
 * asked: a sale says the invoice's warehouse is not permitted, a warehouse map
 * says the warehouse itself is. Same rule, one implementation.
 */
export async function assertMayUseWarehouse(
  ctx: TenancyContext,
  warehouseId: string,
  errorCode = 'INVOICE_WAREHOUSE_NOT_PERMITTED',
): Promise<void> {
  const [scope, branchOf] = await Promise.all([
    branches.scopeFor(ctx),
    readWarehouseBranches(ctx.workspaceId),
  ])
  const branchesConfigured = branchOf !== null
  if (!mayUseWarehouse(scope, branchOf?.get(warehouseId) ?? null, branchesConfigured)) {
    throw new ForbiddenError(errorCode)
  }
}

/** The branch a warehouse is being given must be this workspace's own. */
export async function assertWarehouseBranch(
  ctx: TenancyContext,
  branchId: string | null,
): Promise<void> {
  if (branchId === null) return
  const known = await branches.list(ctx)
  if (!known.some((branch) => branch.id === branchId)) {
    throw new ValidationError('WAREHOUSE_BRANCH_NOT_FOUND')
  }
}
