import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { collectSubordinateIds, detectOrgCycle } from '@hisabche/validation'

export class HrOrgAppraisalService {
  async getOrgChart(tenancy: TenancyContext) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, position, department, reports_to, user_id')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('is_active', true)

    if (error) throw new DatabaseError('Failed to fetch org chart', error)
    const rows = (data ?? []) as Array<{
      id: string
      name: string
      position: string | null
      department: string | null
      reports_to: string | null
      user_id: string | null
    }>

    if (['owner', 'admin'].includes(tenancy.role)) {
      return rows
    }

    const me = rows.find((r) => r.user_id === tenancy.userId)
    if (!me) return []
    const visible = collectSubordinateIds(rows, me.id)
    visible.add(me.id)
    return rows.filter((r) => visible.has(r.id))
  }

  async setReportsTo(tenancy: TenancyContext, employeeId: string, reportsTo: string | null) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, reports_to')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('is_active', true)
    if (error) throw new DatabaseError('Failed to load employees', error)

    const map = new Map<string, string | null>(
      (data ?? []).map((e: { id: string; reports_to: string | null }) => [e.id, e.reports_to]),
    )
    if (detectOrgCycle(map, employeeId, reportsTo)) {
      throw new ValidationError('ORG_CYCLE_DETECTED')
    }

    const { data: updated, error: updErr } = await supabase
      .from('employees')
      .update({ reports_to: reportsTo, updated_at: new Date().toISOString() })
      .eq('id', employeeId)
      .eq('workspace_id', tenancy.workspaceId)
      .select('*')
      .single()
    if (updErr || !updated) throw new DatabaseError('Failed to update reports_to', updErr)
    return updated
  }

  async listDocuments(tenancy: TenancyContext, employeeId: string) {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to list employee documents', error)
    return data ?? []
  }

  async addDocument(
    tenancy: TenancyContext,
    employeeId: string,
    input: { title: string; kind: string; file_url: string },
  ) {
    const { data, error } = await supabase
      .from('employee_documents')
      .insert({
        workspace_id: tenancy.workspaceId,
        employee_id: employeeId,
        title: input.title,
        kind: input.kind,
        file_url: input.file_url,
        created_by: tenancy.userId,
      })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to add employee document', error)
    return data
  }

  async listAppraisals(tenancy: TenancyContext, employeeId: string) {
    const { data, error } = await supabase
      .from('employee_appraisals')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to list appraisals', error)
    return data ?? []
  }

  async createAppraisal(
    tenancy: TenancyContext,
    employeeId: string,
    input: {
      period: string
      criteria: Array<{ label: string; observation: string }>
      notes?: string | undefined
    },
  ) {
    const { data, error } = await supabase
      .from('employee_appraisals')
      .insert({
        workspace_id: tenancy.workspaceId,
        employee_id: employeeId,
        reviewer_id: tenancy.userId,
        period: input.period,
        criteria: input.criteria,
        notes: input.notes ?? null,
      })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to record appraisal', error)
    return data
  }
}

export const hrOrgAppraisalService = new HrOrgAppraisalService()
