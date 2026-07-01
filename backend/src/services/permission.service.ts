// ============================================
// backend/src/services/permission.service.ts
// ============================================

import { supabase } from '../db'
import {
  CreatePermission,
  CreateRole,
  UpdateRole,
  AssignRole,
  RemoveRole,
  CheckPermission,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

// مجوزهای پیش‌فرض سیستم
// مجوزهای پیش‌فرض سیستم
const DEFAULT_PERMISSIONS: Array<{
  code: string
  name: string
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'manage'
}> = [
  // Products
  { code: 'product.create', name: 'ایجاد محصول', resource: 'product', action: 'create' },
  { code: 'product.read', name: 'مشاهده محصول', resource: 'product', action: 'read' },
  { code: 'product.update', name: 'ویرایش محصول', resource: 'product', action: 'update' },
  { code: 'product.delete', name: 'حذف محصول', resource: 'product', action: 'delete' },
  // Invoices
  { code: 'invoice.create', name: 'ایجاد فاکتور', resource: 'invoice', action: 'create' },
  { code: 'invoice.read', name: 'مشاهده فاکتور', resource: 'invoice', action: 'read' },
  { code: 'invoice.update', name: 'ویرایش فاکتور', resource: 'invoice', action: 'update' },
  { code: 'invoice.delete', name: 'حذف فاکتور', resource: 'invoice', action: 'delete' },
  // Customers
  { code: 'customer.create', name: 'ایجاد مشتری', resource: 'customer', action: 'create' },
  { code: 'customer.read', name: 'مشاهده مشتری', resource: 'customer', action: 'read' },
  { code: 'customer.update', name: 'ویرایش مشتری', resource: 'customer', action: 'update' },
  { code: 'customer.delete', name: 'حذف مشتری', resource: 'customer', action: 'delete' },
  // Inventory
  { code: 'inventory.create', name: 'ایجاد موجودی', resource: 'inventory', action: 'create' },
  { code: 'inventory.read', name: 'مشاهده موجودی', resource: 'inventory', action: 'read' },
  { code: 'inventory.update', name: 'ویرایش موجودی', resource: 'inventory', action: 'update' },
  { code: 'inventory.delete', name: 'حذف موجودی', resource: 'inventory', action: 'delete' },
  // Accounting
  { code: 'accounting.create', name: 'ایجاد سند حسابداری', resource: 'accounting', action: 'create' },
  { code: 'accounting.read', name: 'مشاهده حسابداری', resource: 'accounting', action: 'read' },
  { code: 'accounting.update', name: 'ویرایش حسابداری', resource: 'accounting', action: 'update' },
  { code: 'accounting.delete', name: 'حذف سند حسابداری', resource: 'accounting', action: 'delete' },
  // HR
  { code: 'hr.create', name: 'ایجاد کارمند', resource: 'hr', action: 'create' },
  { code: 'hr.read', name: 'مشاهده منابع انسانی', resource: 'hr', action: 'read' },
  { code: 'hr.update', name: 'ویرایش منابع انسانی', resource: 'hr', action: 'update' },
  { code: 'hr.delete', name: 'حذف کارمند', resource: 'hr', action: 'delete' },
  // Projects
  { code: 'project.create', name: 'ایجاد پروژه', resource: 'project', action: 'create' },
  { code: 'project.read', name: 'مشاهده پروژه', resource: 'project', action: 'read' },
  { code: 'project.update', name: 'ویرایش پروژه', resource: 'project', action: 'update' },
  { code: 'project.delete', name: 'حذف پروژه', resource: 'project', action: 'delete' },
  // Reports
  { code: 'report.read', name: 'مشاهده گزارشات', resource: 'report', action: 'read' },
  { code: 'report.export', name: 'خروجی گزارشات', resource: 'report', action: 'export' },
  // Settings
  { code: 'settings.read', name: 'مشاهده تنظیمات', resource: 'settings', action: 'read' },
  { code: 'settings.update', name: 'ویرایش تنظیمات', resource: 'settings', action: 'update' },
  // Users
  { code: 'user.manage', name: 'مدیریت کاربران', resource: 'user', action: 'manage' },
]

export class PermissionService {
  // ─── Seed ─────────────────────────────────────────────────
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
  }

  // ─── Permissions ──────────────────────────────────────────
  async listPermissions() {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('resource')

    if (error) throw new DatabaseError('Failed to fetch permissions', error)
    return data || []
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
      .select()
      .single()

    if (error || !perm) throw new DatabaseError('Failed to create permission', error)
    return perm
  }

  // ─── Roles ────────────────────────────────────────────────
  async listRoles() {
    const { data, error } = await supabase
      .from('roles')
      .select('*, permissions:role_permissions(permission_id)')
      .order('name')

    if (error) throw new DatabaseError('Failed to fetch roles', error)
    return data || []
  }

  async createRole(data: CreateRole) {
    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name: data.name,
        description: data.description || null,
        is_system: false,
      })
      .select()
      .single()

    if (error || !role) throw new DatabaseError('Failed to create role', error)

    // اضافه کردن permissionها
    if (data.permissionIds && data.permissionIds.length > 0) {
      const items = data.permissionIds.map(pid => ({
        role_id: role.id,
        permission_id: pid,
      }))

      await supabase.from('role_permissions').insert(items)
    }

    return this.getRole(role.id)
  }

  async getRole(roleId: string) {
    const { data, error } = await supabase
      .from('roles')
      .select('*, permissions:role_permissions(permission_id)')
      .eq('id', roleId)
      .single()

    if (error || !data) throw new DatabaseError('Role not found', error)
    return data
  }

  async updateRole(id: string, data: UpdateRole) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description

    const { error } = await supabase
      .from('roles')
      .update(updates)
      .eq('id', id)

    if (error) throw new DatabaseError('Failed to update role', error)

    // به‌روزرسانی permissionها
    if (data.permissionIds !== undefined) {
      await supabase.from('role_permissions').delete().eq('role_id', id)

      if (data.permissionIds.length > 0) {
        const items = data.permissionIds.map(pid => ({
          role_id: id,
          permission_id: pid,
        }))
        await supabase.from('role_permissions').insert(items)
      }
    }

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
    return { success: true }
  }

  // ─── User Roles ───────────────────────────────────────────
  async getUserRoles(userId: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*, role:roles(*)')
      .eq('user_id', userId)

    if (error) throw new DatabaseError('Failed to fetch user roles', error)
    return data || []
  }

  async assignRole(data: AssignRole) {
    // بررسی تکراری نبودن
    const { data: existing } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', data.userId)
      .eq('role_id', data.roleId)
      .single()

    if (existing) throw new DatabaseError('User already has this role')

    const { data: userRole, error } = await supabase
      .from('user_roles')
      .insert({
        user_id: data.userId,
        role_id: data.roleId,
      })
      .select()
      .single()

    if (error || !userRole) throw new DatabaseError('Failed to assign role', error)
    return userRole
  }

  async removeRole(data: RemoveRole) {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', data.userId)
      .eq('role_id', data.roleId)

    if (error) throw new DatabaseError('Failed to remove role', error)
    return { success: true }
  }

  // ─── Check Permission ─────────────────────────────────────
  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const { data } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)

    if (!data || data.length === 0) return false

    const roleIds = data.map(r => r.role_id)

    const { data: perms } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .in('role_id', roleIds)

    if (!perms || perms.length === 0) return false

    const permissionIds = perms.map(p => p.permission_id)

    const { data: matched } = await supabase
      .from('permissions')
      .select('id')
      .in('id', permissionIds)
      .eq('code', permissionCode)
      .single()

    return !!matched
  }

  async getUserPermissions(userId: string) {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)

    if (!userRoles || userRoles.length === 0) return []

    const roleIds = userRoles.map(r => r.role_id)

    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permission_id')
      .in('role_id', roleIds)

    if (!rolePerms || rolePerms.length === 0) return []

    const permissionIds = [...new Set(rolePerms.map(p => p.permission_id))]

    const { data: permissions } = await supabase
      .from('permissions')
      .select('*')
      .in('id', permissionIds)
      .order('resource')

    return permissions || []
  }
}