// ============================================
// packages/validation/src/schemas/project.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  positiveNumberSchema,
  isoDateSchema,
  nonNegativeNumberSchema
} from './common.schema'

// ============================================
// Project (پروژه)
// ============================================

export const projectSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  description: optionalStringSchema,
  clientId: uuidSchema.nullable().optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  budget: nonNegativeNumberSchema.default(0),
  currency: z.enum(['AFN', 'USD', 'PKR', 'IRR']).default('AFN'),
  status: z.enum(['planning', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  progress: z.number().int().min(0).max(100).default(0),
  tags: z.array(z.string()).default([]),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Project = z.infer<typeof projectSchema>

export const createProjectSchema = projectSchema.omit({
  id: true,
  progress: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateProject = z.infer<typeof createProjectSchema>

export const updateProjectSchema = projectSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateProject = z.infer<typeof updateProjectSchema>

// ============================================
// Project Task (وظیفه)
// ============================================

export const projectTaskSchema = z.object({
  id: uuidSchema.optional(),
  projectId: uuidSchema,
  title: nonEmptyStringSchema,
  description: optionalStringSchema,
  assigneeId: uuidSchema.nullable().optional(),
  parentTaskId: uuidSchema.nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  estimatedHours: nonNegativeNumberSchema.optional(),
  actualHours: nonNegativeNumberSchema.default(0),
  dueDate: isoDateSchema.optional(),
  completedAt: isoDateSchema.optional().nullable(),
  orderIndex: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type ProjectTask = z.infer<typeof projectTaskSchema>

export const createProjectTaskSchema = projectTaskSchema.omit({
  id: true,
  actualHours: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateProjectTask = z.infer<typeof createProjectTaskSchema>

export const updateProjectTaskSchema = projectTaskSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateProjectTask = z.infer<typeof updateProjectTaskSchema>

// ============================================
// Project Member (عضو پروژه)
// ============================================

export const projectMemberSchema = z.object({
  id: uuidSchema.optional(),
  projectId: uuidSchema,
  employeeId: uuidSchema.nullable().optional(),
  userId: uuidSchema.nullable().optional(),
  role: z.enum(['manager', 'member', 'viewer']).default('member'),
  joinedAt: isoDateSchema.optional(),
  createdAt: isoDateSchema.optional(),
})

export type ProjectMember = z.infer<typeof projectMemberSchema>

export const createProjectMemberSchema = projectMemberSchema.omit({
  id: true,
  joinedAt: true,
  createdAt: true,
})

export type CreateProjectMember = z.infer<typeof createProjectMemberSchema>

// ============================================
// Time Entry (ثبت زمان)
// ============================================

export const timeEntrySchema = z.object({
  id: uuidSchema.optional(),
  projectId: uuidSchema,
  taskId: uuidSchema.nullable().optional(),
  employeeId: uuidSchema,
  date: isoDateSchema,
  hours: positiveNumberSchema,
  description: optionalStringSchema,
  billable: z.boolean().default(true),
  hourlyRate: nonNegativeNumberSchema.default(0),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type TimeEntry = z.infer<typeof timeEntrySchema>

export const createTimeEntrySchema = timeEntrySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateTimeEntry = z.infer<typeof createTimeEntrySchema>

export const updateTimeEntrySchema = timeEntrySchema.partial().extend({
  id: uuidSchema,
})

export type UpdateTimeEntry = z.infer<typeof updateTimeEntrySchema>