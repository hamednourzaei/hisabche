// ============================================
// backend/src/services/human-resources/hr-org-appraisal.service.ts
//
// V61 B.2.17 — who reports to whom, the employee's file, and appraisals.
//
// ⚠️ V61 audit (12 Nov 2026). The first version read `employees.name`,
// `employees.department` and `employees.is_active` — none of them exist
// (the table has `first_name`, `last_name`, `department_id`, `status`,
// `termination_date`), so the org chart and «reports to» answered 500 on
// every call. The writes also took an employee id from the URL without
// checking it belonged to this business: a document or appraisal could be
// attached to another workspace's employee. Every write below first proves
// the employee (and the manager) is this workspace's own.
// ============================================

import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import type { TenancyContext } from '../tenancy.service'
import { collectSubordinateIds, detectOrgCycle } from '@hisabche/validation'

/** One person on the org chart — the raw row names, as `GET /api/employees` sends them. */
export interface OrgChartRow {
  id: string
  first_name: string
  last_name: string
  position: string | null
  department_id: string | null
  reports_to: string | null
}

interface OrgRow extends OrgChartRow {
  user_id: string | null
}

const ORG_COLUMNS = 'id, first_name, last_name, position, department_id, reports_to, user_id'

/** Roles that see the whole chart; everyone else sees themself and the people under them. */
const SEES_WHOLE_CHART = ['owner', 'admin', 'manager']

export class HrOrgAppraisalService {
  /** Everyone still employed (no termination date), ordered so pages are stable. */
  private async currentStaff(workspaceId: string): Promise<OrgRow[]> {
    const { data, error } = await selectAllPages<OrgRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('employees')
          .select(ORG_COLUMNS)
          .eq('workspace_id', workspaceId)
          .is('termination_date', null)
          .order('id', { ascending: true })
          .range(from, to),
    )
    if (error) throw new DatabaseError('Failed to fetch org chart', error)
    return data ?? []
  }

  async getOrgChart(tenancy: TenancyContext): Promise<OrgChartRow[]> {
    const rows = await this.currentStaff(tenancy.workspaceId)
    const strip = ({ user_id: _userId, ...row }: OrgRow): OrgChartRow => row

    if (SEES_WHOLE_CHART.includes(tenancy.role)) return rows.map(strip)

    const me = rows.find((r) => r.user_id === tenancy.userId)
    if (!me) return []
    const visible = collectSubordinateIds(rows, me.id)
    visible.add(me.id)
    return rows.filter((r) => visible.has(r.id)).map(strip)
  }

  /** The employee, if it is THIS workspace's; otherwise NotFound (never another tenant's row). */
  private async assertEmployee(tenancy: TenancyContext, employeeId: string): Promise<void> {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .eq('workspace_id', tenancy.workspaceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to load employee', error)
    if (!data) throw new NotFoundError('Employee')
  }

  async setReportsTo(tenancy: TenancyContext, employeeId: string, reportsTo: string | null) {
    const rows = await this.currentStaff(tenancy.workspaceId)
    const map = new Map<string, string | null>(rows.map((e) => [e.id, e.reports_to]))

    if (!map.has(employeeId)) throw new NotFoundError('Employee')
    // The manager must be someone who works here now — not a former employee,
    // and never another business's person.
    if (reportsTo !== null && !map.has(reportsTo)) {
      throw new ValidationError('ORG_MANAGER_NOT_FOUND')
    }
    if (detectOrgCycle(map, employeeId, reportsTo)) {
      throw new ValidationError('ORG_CYCLE_DETECTED')
    }

    const { data: updated, error: updErr } = await supabase
      .from('employees')
      .update({ reports_to: reportsTo, updated_at: new Date().toISOString() })
      .eq('id', employeeId)
      .eq('workspace_id', tenancy.workspaceId)
      .select('id, reports_to')
      .maybeSingle()
    if (updErr) {
      // The database trigger is the last word on cycles (two edits at once).
      if (String(updErr.message ?? '').includes('ORG_CYCLE_DETECTED')) {
        throw new ValidationError('ORG_CYCLE_DETECTED')
      }
      throw new DatabaseError('Failed to update reports_to', updErr)
    }
    if (!updated) throw new NotFoundError('Employee')
    return updated
  }

  async listDocuments(tenancy: TenancyContext, employeeId: string) {
    await this.assertEmployee(tenancy, employeeId)
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
    await this.assertEmployee(tenancy, employeeId)
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
    await this.assertEmployee(tenancy, employeeId)
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
    await this.assertEmployee(tenancy, employeeId)
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
