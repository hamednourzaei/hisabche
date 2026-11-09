// ============================================
// backend/src/services/dashboard-kpis.service.ts
//
// The KPIs a person added to their dashboard in one workspace
// (user-dashboard-kpis-01). Ids outside the shared list are dropped on read
// (a KPI retired later must not break the dashboard) and refused on write.
// ============================================

import { DASHBOARD_KPI_IDS, type DashboardKpiId } from '@hisabche/validation'

import { supabase } from '../db'
import { ConflictError, DatabaseError } from '../errors/database.error'

/** The table is missing until the migration runs: «not configured», not 500. */
const isMissing = (code: string | undefined) =>
  code === '42P01' || code === 'PGRST205' || code === 'PGRST204'

const KNOWN = new Set<string>(DASHBOARD_KPI_IDS)

export async function readDashboardKpis(
  userId: string,
  workspaceId: string,
): Promise<{ configured: boolean; kpis: DashboardKpiId[] }> {
  const { data, error } = await supabase
    .from('user_dashboard_kpis')
    .select('kpis')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (error) {
    if (isMissing(error.code)) return { configured: false, kpis: [] }
    throw new DatabaseError('Failed to read the dashboard KPIs', error)
  }
  const stored = Array.isArray((data as { kpis?: unknown } | null)?.kpis)
    ? ((data as { kpis: unknown[] }).kpis as unknown[])
    : []
  return {
    configured: true,
    kpis: stored.filter((id): id is DashboardKpiId => typeof id === 'string' && KNOWN.has(id)),
  }
}

export async function saveDashboardKpis(
  userId: string,
  workspaceId: string,
  kpis: readonly DashboardKpiId[],
): Promise<{ configured: true; kpis: DashboardKpiId[] }> {
  const { error } = await supabase.from('user_dashboard_kpis').upsert(
    {
      user_id: userId,
      workspace_id: workspaceId,
      kpis: [...kpis],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,workspace_id' },
  )
  if (error) {
    if (isMissing(error.code)) throw new ConflictError('DASHBOARD_KPIS_NOT_CONFIGURED')
    throw new DatabaseError('Failed to save the dashboard KPIs', error)
  }
  return { configured: true, kpis: [...kpis] }
}
