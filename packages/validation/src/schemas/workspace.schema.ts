// ============================================
// packages/validation/src/schemas/workspace.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Workspace (فضای کاری)
// ============================================

export const workspaceSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  slug: nonEmptyStringSchema,
  description: optionalStringSchema,
  logoUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Workspace = z.infer<typeof workspaceSchema>

export const createWorkspaceSchema = workspaceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>

export const updateWorkspaceSchema = workspaceSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateWorkspace = z.infer<typeof updateWorkspaceSchema>

// ============================================
// Workspace Member (عضو فضای کاری)
// ============================================

export const workspaceMemberSchema = z.object({
  id: uuidSchema.optional(),
  workspaceId: uuidSchema,
  userId: uuidSchema,
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
  joinedAt: isoDateSchema.optional(),
  createdAt: isoDateSchema.optional(),
})

export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>

export const createWorkspaceMemberSchema = workspaceMemberSchema.omit({
  id: true,
  joinedAt: true,
  createdAt: true,
})

export type CreateWorkspaceMember = z.infer<typeof createWorkspaceMemberSchema>

export const updateMemberRoleSchema = z.object({
  memberId: uuidSchema,
  role: z.enum(['admin', 'member', 'viewer']),
})

export type UpdateMemberRole = z.infer<typeof updateMemberRoleSchema>

// ============================================
// Workspace Invite (دعوت‌نامه)
// ============================================

export const workspaceInviteSchema = z.object({
  id: uuidSchema.optional(),
  workspaceId: uuidSchema,
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  invitedBy: uuidSchema,
  token: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected', 'expired']).default('pending'),
  expiresAt: isoDateSchema,
  createdAt: isoDateSchema.optional(),
})

export type WorkspaceInvite = z.infer<typeof workspaceInviteSchema>

export const createInviteSchema = z.object({
  workspaceId: uuidSchema,
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

export type CreateInvite = z.infer<typeof createInviteSchema>

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

export type AcceptInvite = z.infer<typeof acceptInviteSchema>