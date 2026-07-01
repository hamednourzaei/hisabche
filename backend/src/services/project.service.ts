// ============================================
// backend/src/services/project.service.ts
// ============================================

import { supabase } from '../db'
import {
  CreateProject,
  UpdateProject,
  CreateProjectTask,
  UpdateProjectTask,
  CreateProjectMember,
  CreateTimeEntry,
  UpdateTimeEntry,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class ProjectService {
  // ─── Projects ─────────────────────────────────────────────
  async listProjects(userId: string, status?: string) {
    let query = supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch projects', error)
    return data || []
  }

  async createProject(userId: string, data: CreateProject) {
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: data.name,
        description: data.description || null,
        client_id: data.clientId || null,
        start_date: data.startDate || null,
        end_date: data.endDate || null,
        budget: data.budget,
        currency: data.currency,
        status: data.status,
        priority: data.priority,
        tags: data.tags || [],
        user_id: userId,
      })
      .select()
      .single()

    if (error || !project) throw new DatabaseError('Failed to create project', error)

    // اضافه کردن creator به عنوان manager
    await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: userId,
      role: 'manager',
      user_id_owner: userId,
    })

    return project
  }

  async getProject(id: string, userId: string) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) throw new DatabaseError('Project not found', error)
    return data
  }

  async updateProject(userId: string, id: string, data: UpdateProject) {
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
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !project) throw new DatabaseError('Failed to update project', error)
    return project
  }

  async deleteProject(userId: string, id: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete project', error)
    return { success: true }
  }

  // ─── Tasks ────────────────────────────────────────────────
  async listTasks(userId: string, projectId: string, status?: string) {
    let query = supabase
      .from('project_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('project_id', projectId)

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('order_index')

    if (error) throw new DatabaseError('Failed to fetch tasks', error)
    return data || []
  }

  async createTask(userId: string, data: CreateProjectTask) {
    const { data: lastTask } = await supabase
      .from('project_tasks')
      .select('order_index')
      .eq('project_id', data.projectId)
      .eq('user_id', userId)
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
        user_id: userId,
      })
      .select()
      .single()

    if (error || !task) throw new DatabaseError('Failed to create task', error)
    return task
  }
  async updateTask(userId: string, id: string, data: UpdateProjectTask) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.assigneeId !== undefined) updates.assignee_id = data.assigneeId
    if (data.status !== undefined) {
      updates.status = data.status
      if (data.status === 'done') {
        updates.completed_at = new Date().toISOString()
      }
    }
    if (data.priority !== undefined) updates.priority = data.priority
    if (data.dueDate !== undefined) updates.due_date = data.dueDate
    if (data.orderIndex !== undefined) updates.order_index = data.orderIndex
    if (data.tags !== undefined) updates.tags = data.tags

    const { data: task, error } = await supabase
      .from('project_tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !task) throw new DatabaseError('Failed to update task', error)

    await this.recalculateProjectProgress(userId, task.project_id)
    return task
  }

  async deleteTask(userId: string, id: string) {
    const { data: task } = await supabase
      .from('project_tasks')
      .select('project_id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete task', error)

    if (task) {
      await this.recalculateProjectProgress(userId, task.project_id)
    }

    return { success: true }
  }

  // ─── Members ──────────────────────────────────────────────
  async listMembers(userId: string, projectId: string) {
    const { data, error } = await supabase
      .from('project_members')
      .select('*, employee:employees(first_name, last_name)')
      .eq('project_id', projectId)
      .eq('user_id_owner', userId)

    if (error) throw new DatabaseError('Failed to fetch members', error)
    return data || []
  }

  async addMember(userId: string, data: CreateProjectMember) {
    const { data: member, error } = await supabase
      .from('project_members')
      .insert({
        project_id: data.projectId,
        employee_id: data.employeeId || null,
        user_id: data.userId || null,
        role: data.role,
        user_id_owner: userId,
      })
      .select()
      .single()

    if (error || !member) throw new DatabaseError('Failed to add member', error)
    return member
  }

  async removeMember(userId: string, projectId: string, memberId: string) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('id', memberId)
      .eq('user_id_owner', userId)

    if (error) throw new DatabaseError('Failed to remove member', error)
    return { success: true }
  }

  // ─── Time Entries ─────────────────────────────────────────
  async listTimeEntries(userId: string, projectId: string) {
    const { data, error } = await supabase
      .from('project_time_entries')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch time entries', error)
    return data || []
  }

  async createTimeEntry(userId: string, data: CreateTimeEntry) {
    const { data: entry, error } = await supabase
      .from('project_time_entries')
      .insert({
        project_id: data.projectId,
        task_id: data.taskId || null,
        employee_id: data.employeeId,
        date: data.date,
        hours: data.hours,
        description: data.description || null,
        billable: data.billable,
        hourly_rate: data.hourlyRate,
        user_id: userId,
      })
      .select()
      .single()

    if (error || !entry) throw new DatabaseError('Failed to create time entry', error)
    return entry
  }

  async updateTimeEntry(userId: string, id: string, data: UpdateTimeEntry) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.hours !== undefined) updates.hours = data.hours
    if (data.description !== undefined) updates.description = data.description
    if (data.billable !== undefined) updates.billable = data.billable
    if (data.hourlyRate !== undefined) updates.hourly_rate = data.hourlyRate

    const { data: entry, error } = await supabase
      .from('project_time_entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error || !entry) throw new DatabaseError('Failed to update time entry', error)
    return entry
  }

  async deleteTimeEntry(userId: string, id: string) {
    const { error } = await supabase
      .from('project_time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to delete time entry', error)
    return { success: true }
  }

  // ─── Helper ───────────────────────────────────────────────
  private async recalculateProjectProgress(userId: string, projectId: string) {
    const { data: tasks } = await supabase
      .from('project_tasks')
      .select('status')
      .eq('project_id', projectId)
      .eq('user_id', userId)

    if (!tasks || tasks.length === 0) {
      await supabase
        .from('projects')
        .update({ progress: 0 })
        .eq('id', projectId)
        .eq('user_id', userId)
      return
    }

    const doneCount = tasks.filter((t: { status: string }) => t.status === 'done').length
    const progress = Math.round((doneCount / tasks.length) * 100)

    await supabase
      .from('projects')
      .update({ progress })
      .eq('id', projectId)
      .eq('user_id', userId)
  }
}

export default ProjectService