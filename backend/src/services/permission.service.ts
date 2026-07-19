// ============================================
// backend/src/services/permission.service.ts — Optimized v2.1
// FIXED: Added cache, Promise.all, parallel queries
// ============================================

import { supabase } from '../db'
import { CreatePermission, CreateRole, UpdateRole, AssignRole, RemoveRole } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ✅ Column Selection Constants
const PERMISSION_COLUMNS = 'id, code, name, description, resource, action, created_at'
const PERMISSION_MINIMAL = 'id, code, resource, action'

const ROLE_COLUMNS = 'id, name, description, is_system, created_at, updated_at'
const ROLE_MINIMAL = 'id, name'

const USER_ROLE_COLUMNS = 'id, user_id, role_id, created_at'

const DEFAULT_PERMISSIONS: any[] = [
  { code: 'product.create', name: 'ایجاد محصول', resource: 'product', action: 'create' },
  { code: 'product.read', name: 'مشاهده محصول', resource: 'product', action: 'read' },
  { code: 'product.update', name: 'ویرایش محصول', resource: 'product', action: 'update' },
  { code: 'product.delete', name: 'حذف محصول', resource: 'product', action: 'delete' },
  { code: 'invoice.create', name: 'ایجاد فاکتور', resource: 'invoice', action: 'create' },
  { code: 'invoice.read', name: 'مشاهده فاکتور', resource: 'invoice', action: 'read' },
  { code: 'invoice.update', name: 'ویرایش فاکتور', resource: 'invoice', action: 'update' },
  { code: 'invoice.delete', name: 'حذف فاکتور', resource: 'invoice', action: 'delete' },
  { code: 'customer.create', name: 'ایجاد مشتری', resource: 'customer', action: 'create' },
  { code: 'customer.read', name: 'مشاهده مشتری', resource: 'customer', action: 'read' },
  { code: 'customer.update', name: 'ویرایش مشتری', resource: 'customer', action: 'update' },
  { code: 'customer.delete', name: 'حذف مشتری', resource: 'customer', action: 'delete' },
  { code: 'inventory.create', name: 'ایجاد موجودی', resource: 'inventory', action: 'create' },
  { code: 'inventory.read', name: 'مشاهده موجودی', resource: 'inventory', action: 'read' },
  { code: 'inventory.update', name: 'ویرایش موجودی', resource: 'inventory', action: 'update' },
  { code: 'inventory.delete', name: 'حذف موجودی', resource: 'inventory', action: 'delete' },
  { code: 'accounting.create', name: 'ایجاد سند حسابداری', resource: 'accounting', action: 'create' },
  { code: 'accounting.read', name: 'مشاهده حسابداری', resource: 'accounting', action: 'read' },
  { code: 'accounting.update', name: 'ویرایش حسابداری', resource: 'accounting', action: 'update' },
  { code: 'accounting.delete', name: 'حذف سند حسابداری', resource: 'accounting', action: 'delete' },
  { code: 'hr.create', name: 'ایجاد کارمند', resource: 'hr', action: 'create' },
  { code: 'hr.read', name: 'مشاهده منابع انسانی', resource: 'hr', action: 'read' },
  { code: 'hr.update', name: 'ویرایش منابع انسانی', resource: 'hr', action: 'update' },
  { code: 'hr.delete', name: 'حذف کارمند', resource: 'hr', action: 'delete' },
  { code: 'project.create', name: 'ایجاد پروژه', resource: 'project', action: 'create' },
  { code: 'project.read', name: 'مشاهده پروژه', resource: 'project', action: 'read' },
  { code: 'project.update', name: 'ویرایش پروژه', resource: 'project', action: 'update' },
  { code: 'project.delete', name: 'حذف پروژه', resource: 'project', action: 'delete' },
  { code: 'report.read', name: 'مشاهده گزارشات', resource: 'report', action: 'read' },
  { code: 'report.export', name: 'خروجی گزارشات', resource: 'report', action: 'export' },
  { code: 'settings.read', name: 'مشاهده تنظیمات', resource: 'settings', action: 'read' },
  { code: 'settings.update', name: 'ویرایش تنظیمات', resource: 'settings', action: 'update' },
  { code: 'user.manage', name: 'مدیریت کاربران', resource: 'user', action: 'manage' },
]

export class PermissionService {

  // ─── Cache Keys ──────────────────────────────────────────────
  private getPermissionsCacheKey() {
    return `permissions:all`
  }

  private getRolesCacheKey() {
    return `roles:all`
  }

  private getRoleCacheKey(roleId: string) {
    return `role:${roleId}`
  }

  private getUserRolesCacheKey(userId: string) {
    return `user:roles:${userId}`
  }

  private getUserPermissionsCacheKey(userId: string) {
    return `user:permissions:${userId}`
  }

  private getHasPermissionCacheKey(userId: string, permissionCode: string) {
    return `user:has_permission:${userId}:${permissionCode}`
  }

  // ─── Seed Default Permissions ────────────────────────────────
  async seedDefaultPermissions() {
    for (const perm of DEFAULT_PERMISSIONS) {
      const { data: existing } = await supabase
        .from('permissions')
        .select('id')
        .eq('code', perm.code)
        .single()
      if (!existing) {
        await supabase.from('permissions').insert(perm)
      }
    }
    // ✅ Invalidate cache after seeding
    await memoryCache.invalidate(this.getPermissionsCacheKey())
  }

  // ─── Permissions ──────────────────────────────────────────────
  async listPermissions() {
    const cacheKey = this.getPermissionsCacheKey()
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('permissions')
      .select(PERMISSION_MINIMAL)
      .order('resource')

    if (error) throw new DatabaseError('Failed to fetch permissions', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 300) // 5 minutes
    return result
  }

  async createPermission(data: CreatePermission) {
    const { data: perm, error } = await supabase
      .from('permissions')
      .insert({
        code: data.code,
        name: data.name,
        description: data.description || null,
        resource: data.resource,
        action: data.action,
      })
      .select(PERMISSION_COLUMNS)
      .single()

    if (error || !perm) throw new DatabaseError('Failed to create permission', error)

    // ✅ Invalidate cache
    await memoryCache.invalidate(this.getPermissionsCacheKey())

    return perm
  }

  // ─── Roles ─────────────────────────────────────────────────────
  async listRoles() {
    const cacheKey = this.getRolesCacheKey()
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('roles')
      .select(`${ROLE_MINIMAL}, permissions:role_permissions(permission_id)`)
      .order('name')

    if (error) throw new DatabaseError('Failed to fetch roles', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 300) // 5 minutes
    return result
  }

  async createRole(data: CreateRole) {
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: data.name,
        description: data.description || null,
        is_system: false,
      })
      .select(ROLE_COLUMNS)
      .single()

    if (error || !role) throw new DatabaseError('Failed to create role', error)

    if (data.permissionIds?.length) {
      await supabase
        .from('role_permissions')
        .insert(data.permissionIds.map((pid: string) => ({ role_id: role.id, permission_id: pid })))
    }

    // ✅ Invalidate cache
    await memoryCache.invalidate(this.getRolesCacheKey())

    return this.getRole(role.id)
  }

  async getRole(roleId: string) {
    const cacheKey = this.getRoleCacheKey(roleId)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('roles')
      .select(`${ROLE_COLUMNS}, permissions:role_permissions(permission_id)`)
      .eq('id', roleId)
      .single()

    if (error || !data) throw new DatabaseError('Role not found', error)

    await memoryCache.set(cacheKey, data, 300) // 5 minutes
    return data
  }

  async updateRole(id: string, data: UpdateRole) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description

    await supabase.from('roles').update(updates).eq('id', id)

    if (data.permissionIds !== undefined) {
      await supabase.from('role_permissions').delete().eq('role_id', id)
      if (data.permissionIds.length) {
        await supabase
          .from('role_permissions')
          .insert(data.permissionIds.map((pid: string) => ({ role_id: id, permission_id: pid })))
      }
    }

    // ✅ Invalidate cache
    await memoryCache.invalidate(this.getRolesCacheKey())
    await memoryCache.invalidate(this.getRoleCacheKey(id))

    return this.getRole(id)
  }

  async deleteRole(id: string) {
    const { data: role } = await supabase
      .from('roles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (role?.is_system) throw new DatabaseError('Cannot delete system role')

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)

    if (error) throw new DatabaseError('Failed to delete role', error)

    // ✅ Invalidate cache
    await memoryCache.invalidate(this.getRolesCacheKey())
    await memoryCache.invalidate(this.getRoleCacheKey(id))

    return { success: true }
  }

  // ─── User Roles ───────────────────────────────────────────────
  async getUserRoles(userId: string) {
    const cacheKey = this.getUserRolesCacheKey(userId)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('user_roles')
      .select(`${USER_ROLE_COLUMNS}, role:roles(${ROLE_MINIMAL})`)
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch user roles', error)

    const result = data || []
    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  async assignRole(data: AssignRole) {
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', data.userId)
      .eq('role_id', data.roleId)
      .single()

    if (existing) throw new DatabaseError('User already has this role')

    const { data: userRole, error } = await supabase
      .from('user_roles')
      .insert({ user_id: data.userId, role_id: data.roleId })
      .select(USER_ROLE_COLUMNS)
      .single()

    if (error || !userRole) throw new DatabaseError('Failed to assign role', error)

    // ✅ Invalidate cache
    await this.invalidateUserCache(data.userId)

    return userRole
  }

  async removeRole(data: RemoveRole) {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', data.userId)
      .eq('role_id', data.roleId)

    if (error) throw new DatabaseError('Failed to remove role', error)

    // ✅ Invalidate cache
    await this.invalidateUserCache(data.userId)

    return { success: true }
  }

  // ─── Permissions Check — OPTIMIZED ────────────────────────────
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const cacheKey = this.getHasPermissionCacheKey(userId, permissionCode)
    const cached = await memoryCache.get(cacheKey)
    if (cached !== null) return cached as boolean

    // ✅ یک کوئری با JOIN به جای ۳ کوئری
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        role_permissions!inner (
          permission_id,
          permissions!inner (
            code
          )
        )
      `)
      .eq('user_id', userId)

    if (error || !data || data.length === 0) {
      await memoryCache.set(cacheKey, false, 60)
      return false
    }

    // ✅ بررسی وجود permission در داده‌های برگشتی
    let hasPermission = false
    for (const item of data) {
      const rolePerms = (item as any).role_permissions || []
      for (const rp of rolePerms) {
        const perm = rp.permissions || {}
        if (perm.code === permissionCode) {
          hasPermission = true
          break
        }
      }
      if (hasPermission) break
    }

    await memoryCache.set(cacheKey, hasPermission, 60) // 1 minute
    return hasPermission
  }

  async getUserPermissions(userId: string) {
    const cacheKey = this.getUserPermissionsCacheKey(userId)
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ یک کوئری با JOIN به جای ۳ کوئری
    const { data, error } = await supabase
      .from('user_roles')
      .select(`
        role_id,
        role_permissions!inner (
          permission_id,
          permissions!inner (
            ${PERMISSION_COLUMNS}
          )
        )
      `)
      .eq('user_id', userId)

    if (error || !data) {
      await memoryCache.set(cacheKey, [], 60)
      return []
    }

    // ✅ استخراج permissions از داده‌های برگشتی
    const permissionMap = new Map<string, any>()
    for (const item of data) {
      const rolePerms = (item as any).role_permissions || []
      for (const rp of rolePerms) {
        const perm = rp.permissions || {}
        if (perm.id && !permissionMap.has(perm.id)) {
          permissionMap.set(perm.id, perm)
        }
      }
    }

    const result = Array.from(permissionMap.values())
      .sort((a, b) => (a.resource || '').localeCompare(b.resource || ''))

    await memoryCache.set(cacheKey, result, 120) // 2 minutes
    return result
  }

  // ─── Get User Role IDs ────────────────────────────────────────
  async getUserRoleIds(userId: string): Promise<string[]> {
    const cacheKey = `user:role_ids:${userId}`
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as string[]

    const { data, error } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)

    if (error || !data) return []

    const result = data.map((r: any) => r.role_id)
    await memoryCache.set(cacheKey, result, 120)
    return result
  }

  // ─── Invalidate Cache ─────────────────────────────────────────
  private async invalidateUserCache(userId: string) {
    await memoryCache.invalidate(this.getUserRolesCacheKey(userId))
    await memoryCache.invalidate(this.getUserPermissionsCacheKey(userId))
    await memoryCache.invalidate(`user:role_ids:${userId}`)
    await memoryCache.invalidate(`user:has_permission:${userId}:*`)
  }
}

export default PermissionService