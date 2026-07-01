// ============================================
// packages/validation/src/schemas/permission.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  nonEmptyStringSchema,
  optionalStringSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Permission (مجوز)
// ============================================

export const permissionSchema = z.object({
  id: uuidSchema.optional(),
  code: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  description: optionalStringSchema,
  resource: nonEmptyStringSchema,
  action: z.enum(['create', 'read', 'update', 'delete', 'export', 'manage']),
  createdAt: isoDateSchema.optional(),
})

export type Permission = z.infer<typeof permissionSchema>

export const createPermissionSchema = permissionSchema.omit({
  id: true,
  createdAt: true,
})

export type CreatePermission = z.infer<typeof createPermissionSchema>

// ============================================
// Role (نقش)
// ============================================

export const roleSchema = z.object({
  id: uuidSchema.optional(),
  name: nonEmptyStringSchema,
  description: optionalStringSchema,
  isSystem: z.boolean().default(false),
  permissionIds: z.array(uuidSchema).default([]),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
})

export type Role = z.infer<typeof roleSchema>

export const createRoleSchema = roleSchema.omit({
  id: true,
  isSystem: true,
  createdAt: true,
  updatedAt: true,
})

export type CreateRole = z.infer<typeof createRoleSchema>

export const updateRoleSchema = roleSchema.partial().extend({
  id: uuidSchema,
})

export type UpdateRole = z.infer<typeof updateRoleSchema>

// ============================================
// User Role (نقش کاربر)
// ============================================

export const userRoleSchema = z.object({
  id: uuidSchema.optional(),
  userId: uuidSchema,
  roleId: uuidSchema,
  createdAt: isoDateSchema.optional(),
})

export type UserRole = z.infer<typeof userRoleSchema>

export const assignRoleSchema = z.object({
  userId: uuidSchema,
  roleId: uuidSchema,
})

export type AssignRole = z.infer<typeof assignRoleSchema>

export const removeRoleSchema = z.object({
  userId: uuidSchema,
  roleId: uuidSchema,
})

export type RemoveRole = z.infer<typeof removeRoleSchema>

// ============================================
// Check Permission
// ============================================

export const checkPermissionSchema = z.object({
  userId: uuidSchema,
  permissionCode: nonEmptyStringSchema,
})

export type CheckPermission = z.infer<typeof checkPermissionSchema>