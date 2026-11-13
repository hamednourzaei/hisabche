// ============================================
// backend/src/services/project.service.ts — Optimized v2.1
// FIXED: Added cache, Promise.all, parallel queries
// ============================================

import { baseCurrencyOf } from './base-currency'
import { supabase } from '../db'
import {
  CreateProject,
  UpdateProject,
  CreateProjectTask,
  UpdateProjectTask,
  CreateProjectMember,
  CreateTimeEntry,
  UpdateTimeEntry,
  projectProgress,
} from '@hisabche/validation'
import { DatabaseError, NotFoundError } from '../errors/database.error'
import type { TenancyContext } from './tenancy.service'
import { memoryCache } from '../utils/pagination'
import { logBusinessEvent } from './event-log.service'
import { TimesheetsService } from './timesheets/timesheets.service'
import type { TimeEntry } from './timesheets/billing.domain'

const timesheetsService = new TimesheetsService()

function toProjectTimeEntryView(entry: TimeEntry, workspaceId: string) {
  return {
    id: entry.id,
    project_id: entry.projectId,
    task_id: entry.taskId,
    employee_id: entry.employeeId,
    date: entry.onDate,
    hours: Math.round((entry.minutes / 60) * 100) / 100,
    description: entry.description || null,
    billable: entry.billable,
    hourly_rate:
      entry.rateMinor === null || entry.rateMinor === undefined ? null : entry.rateMinor / 100,
    invoice_id: entry.invoiceId,
    workspace_id: workspaceId,
  }
}

// ✅ Column Selection Constants
const PROJECT_LIST_COLUMNS =
  'id, name, description, client_id, start_date, end_date, budget, currency, status, priority, progress, tags, created_at, updated_at'
const PROJECT_MINIMAL = 'id, name, status, priority, progress'

const TASK_LIST_COLUMNS =
  'id, project_id, title, description, assignee_id, parent_task_id, status, priority, estimated_hours, actual_hours, due_date, completed_at, order_index, tags, created_at, updated_at'
const TASK_MINIMAL = 'id, project_id, title, status, priority, order_index'

const MEMBER_COLUMNS = 'id, project_id, employee_id, user_id, role, joined_at'
const MEMBER_MINIMAL = 'id, user_id, role'

export class ProjectService {
  // ─── Cache Keys ──────────────────────────────────────────────
  private getProjectsCacheKey(workspaceId: string, status?: string) {
    return `projects:${workspaceId}:${status || 'all'}`
  }

  private getProjectCacheKey(workspaceId: string, id: string) {
    return `project:${workspaceId}:${id}`
  }

  private getTasksCacheKey(workspaceId: string, projectId: string, status?: string) {
    return `project:tasks:${workspaceId}:${projectId}:${status || 'all'}`
  }

  private getMembersCacheKey(workspaceId: string, projectId: string) {
    return `project:members:${workspaceId}:${projectId}`
  }

  private getTimeEntriesCacheKey(workspaceId: string, projectId: string) {
    return `project:time:${workspaceId}:${projectId}`
  }

  async assertProjectOwned(workspaceId: string, projectId: string): Promise<void> {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to verify project ownership', error)
    if (!data) throw new NotFoundError('Project')
  }

  // ─── Projects ─────────────────────────────────────────────────
  async listProjects(ctx: TenancyContext, status?: string) {
    const { workspaceId } = ctx
    const cacheKey = this.getProjectsCacheKey(workspaceId, status)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase.from('projects').select(PROJECT_MINIMAL).eq('workspace_id', workspaceId)

    if (status) query = query.eq('status', status)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to fetch projects', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  async createProject(ctx: TenancyContext, data: CreateProject) {
    const { workspaceId, userId } = ctx
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: data.name,
        description: data.description || null,
        client_id: data.clientId || null,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        budget: data.budget,
        // None named = the currency this business keeps its books in.
        currency: data.currency ?? (await baseCurrencyOf(ctx.workspaceId)),
        status: data.status,
        priority: data.priority,
        tags: data.tags || [],
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(PROJECT_LIST_COLUMNS)
      .single()

    if (error || !project) throw new DatabaseError('Failed to create project', error)

    // ✅ اضافه کردن creator به عنوان manager
    const { error: memberError } = await supabase.from('project_members').insert({
      project_id: project.id,
      workspace_id: workspaceId,
      user_id: userId,
      role: 'manager',
    })

    if (memberError) {
      console.error('Failed to add project member:', memberError)
      // ❗ ادامه می‌دهیم چون project ایجاد شده
    }

    // ✅ Invalidate cache
    await this.invalidateProjectCache(workspaceId)

    logBusinessEvent({
      userId,
      entityType: 'project',
      entityId: project.id,
      action: 'created',
      title: `پروژه جدید: ${project.name}`,
      description: project.description || undefined,
      notify: false,
    }).catch((err) => console.error('[ProjectService] logBusinessEvent failed:', err))

    return project
  }

  async getProject(id: string, ctx: TenancyContext) {
    const { workspaceId } = ctx
    const cacheKey = this.getProjectCacheKey(workspaceId, id)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_LIST_COLUMNS)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) throw new DatabaseError('Project not found', error)

    await memoryCache.set(cacheKey, data, 300) // 5 minutes
    return data
  }

  async updateProject(ctx: TenancyContext, id: string, data: UpdateProject) {
    const { workspaceId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.status !== undefined) updates.status = data.status
    if (data.priority !== undefined) updates.priority = data.priority
    if (data.progress !== undefined) updates.progress = data.progress
    if (data.budget !== undefined) updates.budget = data.budget
    if (data.startDate !== undefined) updates.start_date = data.startDate
    if (data.endDate !== undefined) updates.end_date = data.endDate
    if (data.tags !== undefined) updates.tags = data.tags

    const { data: project, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(PROJECT_LIST_COLUMNS)
      .single()

    if (error || !project) throw new DatabaseError('Failed to update project', error)

    // ✅ Invalidate cache
    await this.invalidateProjectCache(workspaceId, id)

    return project
  }

  async deleteProject(ctx: TenancyContext, id: string) {
    const { workspaceId } = ctx
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to delete project', error)

    // ✅ Invalidate cache
    await this.invalidateProjectCache(workspaceId, id)

    return { success: true }
  }

  // ─── Tasks ────────────────────────────────────────────────────
  async listTasks(ctx: TenancyContext, projectId: string, status?: string) {
    const { workspaceId } = ctx
    await this.assertProjectOwned(workspaceId, projectId)
    const cacheKey = this.getTasksCacheKey(workspaceId, projectId, status)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    let query = supabase
      .from('project_tasks')
      .select(TASK_MINIMAL)
      .eq('workspace_id', workspaceId)
      .eq('project_id', projectId)

    if (status) query = query.eq('status', status)

    const { data, error } = await query.order('order_index')
    if (error) throw new DatabaseError('Failed to fetch tasks', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 60) // 1 minute
    return result
  }

  async createTask(ctx: TenancyContext, data: CreateProjectTask) {
    const { workspaceId, userId } = ctx
    await this.assertProjectOwned(workspaceId, data.projectId)
    // ✅ گرفتن آخرین order_index با یک کوئری
    const { data: lastTask } = await supabase
      .from('project_tasks')
      .select('order_index')
      .eq('project_id', data.projectId)
      .eq('workspace_id', workspaceId)
      .order('order_index', { ascending: false })
      .limit(1)

    const orderIndex = (lastTask?.[0]?.order_index ?? 0) + 1

    const { data: task, error } = await supabase
      .from('project_tasks')
      .insert({
        project_id: data.projectId,
        title: data.title,
        description: data.description || null,
        assignee_id: data.assigneeId || null,
        parent_task_id: data.parentTaskId || null,
        status: data.status,
        priority: data.priority,
        estimated_hours: data.estimatedHours || null,
        due_date: data.dueDate || null,
        order_index: orderIndex,
        tags: data.tags || [],
        workspace_id: workspaceId,
        user_id: userId,
      })
      .select(TASK_LIST_COLUMNS)
      .single()

    if (error || !task) throw new DatabaseError('Failed to create task', error)

    // ✅ افزودن وظیفه‌ی جدید مخرج نسبت انجام‌شده/کل را تغییر می‌دهد،
    // پس progress پروژه باید دوباره محاسبه شود (قبلاً فقط در
    // updateTask/deleteTask انجام می‌شد و این یک باگ بود)
    await this.recalculateProjectProgress(ctx, data.projectId)
    await this.invalidateTaskCache(workspaceId, data.projectId)

    return task
  }

  async updateTask(ctx: TenancyContext, id: string, data: UpdateProjectTask) {
    const { workspaceId } = ctx
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.assigneeId !== undefined) updates.assignee_id = data.assigneeId
    if (data.status !== undefined) {
      updates.status = data.status
      if (data.status === 'done') updates.completed_at = new Date().toISOString()
    }
    if (data.priority !== undefined) updates.priority = data.priority
    if (data.dueDate !== undefined) updates.due_date = data.dueDate
    if (data.orderIndex !== undefined) updates.order_index = data.orderIndex
    if (data.tags !== undefined) updates.tags = data.tags

    // ✅ گرفتن projectId قبل از به‌روزرسانی
    const { data: existing } = await supabase
      .from('project_tasks')
      .select('project_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    const { data: task, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select(TASK_LIST_COLUMNS)
      .single()

    if (error || !task) throw new DatabaseError('Failed to update task', error)

    // ✅ به‌روزرسانی progress
    if (existing) {
      await this.recalculateProjectProgress(ctx, existing.project_id)
      await this.invalidateTaskCache(workspaceId, existing.project_id)
    }

    return task
  }

  async deleteTask(ctx: TenancyContext, id: string) {
    const { workspaceId } = ctx
    const { data: task } = await supabase
      .from('project_tasks')
      .select('project_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw new DatabaseError('Failed to delete task', error)

    if (task) {
      await this.recalculateProjectProgress(ctx, task.project_id)
      await this.invalidateTaskCache(workspaceId, task.project_id)
    }

    return { success: true }
  }

  // ─── Members ──────────────────────────────────────────────────
  async listMembers(ctx: TenancyContext, projectId: string) {
    const { workspaceId } = ctx
    await this.assertProjectOwned(workspaceId, projectId)
    const cacheKey = this.getMembersCacheKey(workspaceId, projectId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('project_members')
      .select(`${MEMBER_MINIMAL}, employee:employees(first_name, last_name)`)
      .eq('project_id', projectId)

    if (error) throw new DatabaseError('Failed to fetch members', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  async addMember(ctx: TenancyContext, data: CreateProjectMember) {
    const { workspaceId } = ctx
    await this.assertProjectOwned(workspaceId, data.projectId)
    const { data: member, error } = await supabase
      .from('project_members')
      .insert({
        project_id: data.projectId,
        employee_id: data.employeeId || null,
        user_id: data.userId || null,
        role: data.role,
      })
      .select(MEMBER_COLUMNS)
      .single()

    if (error || !member) throw new DatabaseError('Failed to add member', error)

    // ✅ Invalidate cache
    await this.invalidateMemberCache(workspaceId, data.projectId)

    return member
  }

  async removeMember(ctx: TenancyContext, projectId: string, memberId: string) {
    const { workspaceId } = ctx
    await this.assertProjectOwned(workspaceId, projectId)
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('id', memberId)

    if (error) throw new DatabaseError('Failed to remove member', error)

    // ✅ Invalidate cache
    await this.invalidateMemberCache(workspaceId, projectId)

    return { success: true }
  }

  // ─── Time Entries (delegated to canonical TimesheetsService / time_entries) ─
  async listTimeEntries(ctx: TenancyContext, projectId: string) {
    const { workspaceId } = ctx
    await this.assertProjectOwned(workspaceId, projectId)
    const cacheKey = this.getTimeEntriesCacheKey(workspaceId, projectId)

    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const entries = await timesheetsService.listEntries(ctx, { projectId })
    const result = entries.map((entry) => toProjectTimeEntryView(entry, workspaceId))
    await memoryCache.set(cacheKey, result, 60) // 1 minute
    return result
  }

  async createTimeEntry(ctx: TenancyContext, data: CreateTimeEntry) {
    const { workspaceId } = ctx
    await this.assertProjectOwned(workspaceId, data.projectId)
    const entry = await timesheetsService.logTime(ctx, {
      projectId: data.projectId,
      taskId: data.taskId || null,
      employeeId: data.employeeId,
      onDate: data.date,
      minutes: Math.max(1, Math.round(Number(data.hours) * 60)),
      billable: data.billable,
      rateMinor: data.hourlyRate == null ? null : Math.round(data.hourlyRate * 100),
      description: data.description || '',
    })

    await this.invalidateTimeCache(workspaceId, data.projectId)
    return toProjectTimeEntryView(entry, workspaceId)
  }

  async updateTimeEntry(ctx: TenancyContext, id: string, data: UpdateTimeEntry) {
    const { workspaceId } = ctx
    const entry = await timesheetsService.updateEntry(ctx, id, {
      minutes: data.hours === undefined ? undefined : Math.max(1, Math.round(data.hours * 60)),
      billable: data.billable,
      rateMinor:
        data.hourlyRate === undefined
          ? undefined
          : data.hourlyRate === null
            ? null
            : Math.round(data.hourlyRate * 100),
      description: data.description,
    })

    if (entry.projectId) await this.assertProjectOwned(entry.projectId, workspaceId)
    await this.invalidateTimeCache(workspaceId, entry.projectId)
    return toProjectTimeEntryView(entry, workspaceId)
  }

  async deleteTimeEntry(ctx: TenancyContext, id: string) {
    const { workspaceId } = ctx
    const deleted = await timesheetsService.deleteEntry(ctx, id)
    await this.invalidateTimeCache(workspaceId, deleted.projectId)
    return { success: true }
  }

  // ─── Helper ───────────────────────────────────────────────────
  private async recalculateProjectProgress(ctx: TenancyContext, projectId: string) {
    const { workspaceId } = ctx
    // ✅ فقط status را انتخاب کن
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('status')
      .eq('project_id', projectId)
      .eq('workspace_id', workspaceId)

    if (!tasks || tasks.length === 0) {
      await supabase
        .from('projects')
        .update({ progress: 0 })
        .eq('id', projectId)
        .eq('workspace_id', workspaceId)
      return
    }

    const progress = projectProgress(tasks.map((t: any) => String(t.status)))

    await supabase
      .from('projects')
      .update({ progress })
      .eq('id', projectId)
      .eq('workspace_id', workspaceId)

    // ✅ Invalidate project cache
    await this.invalidateProjectCache(workspaceId, projectId)
  }

  // ─── Invalidate Cache ────────────────────────────────────────
  private async invalidateProjectCache(workspaceId: string, projectId?: string) {
    await memoryCache.invalidate(this.getProjectsCacheKey(workspaceId))
    if (projectId) {
      await memoryCache.invalidate(this.getProjectCacheKey(workspaceId, projectId))
    }
  }

  private async invalidateTaskCache(workspaceId: string, projectId: string) {
    await memoryCache.invalidate(this.getTasksCacheKey(workspaceId, projectId))
  }

  private async invalidateMemberCache(workspaceId: string, projectId: string) {
    await memoryCache.invalidate(this.getMembersCacheKey(workspaceId, projectId))
  }

  private async invalidateTimeCache(workspaceId: string, projectId: string) {
    await memoryCache.invalidate(this.getTimeEntriesCacheKey(workspaceId, projectId))
  }
}

export default ProjectService
