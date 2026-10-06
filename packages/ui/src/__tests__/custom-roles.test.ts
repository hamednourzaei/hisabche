// ============================================
// «نقش‌ها و دسترسی‌ها» — a role the business makes for itself, and what it does.
//
// What can go wrong: a role that changes nothing (the «پروفایل دسترسی» chosen
// for an employee was a row the server never read); a role added ON TOP of the
// base role, so «فاکتور = نمی‌بیند» still lets them invoice; an owner of one
// business editing a profile every business shares; a deleted role widening
// its holders' access; a part the role does not include still sitting in the
// menu with a lock; the employee form asking for anything but the role; the
// screen describing a rule that is no longer true.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))
const server = (...parts: string[]) => code(read('backend', 'src', ...parts))

const resolver = server('services', 'authorization', 'workspace-access.service.ts')
const matrix = server('services', 'authorization', 'permission-matrix.service.ts')
const view = ui('permissions', 'permission-matrix-view.tsx')

describe('a role decides — on the server', () => {
  it('both paths end in ONE function, and it reads the custom role', () => {
    expect(resolver).toContain('export function resolveEffectiveAccess(')
    expect(resolver.split('withAccess(resolved, {').length - 1).toBeGreaterThanOrEqual(3)
    expect(resolver).toContain('const custom = customRoleAccess(input.customRole)')
  })

  it('the role REPLACES the base set, and the owner is never narrowed', () => {
    expect(resolver).toContain("if (input.role === 'owner' || input.customRole === null) {")
    expect(resolver).toContain(
      'capabilities: restrictByModuleBlocks(input.role, custom.capabilities, input.blocks),',
    )
  })

  it('a database that did not look is asked — the role is never silently skipped', () => {
    expect(resolver).toContain(
      "if (payload.custom_role !== undefined || resolved.role === 'owner') return resolved",
    )
    expect(resolver).toContain(
      'const customRole = await readCustomRole(resolved.workspaceId, userId)',
    )
    // …and only a role THIS business owns.
    expect(resolver).toContain(".eq('role.workspace_id', workspaceId)")
  })
})

describe('whose role it is', () => {
  it('a shared template is never written from inside a business', () => {
    const setCell = matrix.slice(
      matrix.indexOf('async setCell('),
      matrix.indexOf('async assignProfile('),
    )
    expect(setCell).toContain(
      'if ((role as Record<string, any>).workspace_id !== ctx.workspaceId) {',
    )
    expect(setCell).toContain("'PERMISSION_TEMPLATE_READONLY")
    // The refusal comes BEFORE the write to role_permissions.
    expect(setCell.indexOf('PERMISSION_TEMPLATE_READONLY')).toBeLessThan(
      setCell.indexOf(".from('role_permissions')"),
    )
  })

  it('only a role made here can be given to a person', () => {
    expect(matrix).toContain("'PERMISSION_ROLE_NOT_ASSIGNABLE")
  })

  it('a role somebody holds is not deleted — deleting must never widen access', () => {
    const remove = matrix.slice(
      matrix.indexOf('async deleteRole('),
      matrix.indexOf('async membersOfRole('),
    )
    expect(remove).toContain(
      "if ((count ?? 0) > 0) throw new ConflictError('PERMISSION_ROLE_IN_USE')",
    )
    expect(remove.indexOf('PERMISSION_ROLE_IN_USE')).toBeLessThan(remove.indexOf('.delete()'))
    expect(remove).toContain(".eq('workspace_id', ctx.workspaceId)")
  })

  it('making, renaming and deleting a role are the owner’s, behind the members capability', () => {
    const routes = server('routes', 'permission.routes.ts')
    expect(routes).toContain(
      "const roleGuard = [authenticate, requireWorkspaceContext, requireCapability('member.manage')]",
    )
    for (const method of ['post', 'patch', 'delete']) {
      expect(routes, method).toContain(`fastify.${method}( '/api/permissions/roles`)
    }
    expect(matrix.split('this.requireOwner(ctx)').length - 1).toBe(3)
  })
})

describe('«نمی‌بیند» is not in the menu', () => {
  it('the server names the modules the role leaves out', () => {
    const route = server('routes', 'governance.routes.ts')
    expect(route).toContain('hiddenModules:')
    expect(route).toContain('...(request.tenancy.hiddenModules ?? []),')
  })

  it.each([
    ['web', read('apps', 'web', 'app', '[lang]', '(dashboard)', 'dashboard-layout.tsx')],
    ['shell', read('packages', 'app-shell', 'src', 'components', 'layout', 'sidebar.tsx')],
  ])('the %s menu filters them out — it does not draw them locked', (_name, source) => {
    const layout = code(source)
    expect(layout).toContain("(useMyCapabilities().data?.hiddenModules ?? []).join(',')")
    expect(layout.split('!isNavLocked(item.path, blockedOf(hiddenKey))').length - 1).toBe(2)
    // A per-person block is still drawn locked.
    expect(layout).toContain('locked: isNavLocked(item.path, blockedOf(blockedKey)),')
  })
})

describe('the screen', () => {
  it('three plain choices and what each means, in all three languages', () => {
    expect(view).toContain('data-permission-legend=""')
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(
        read('packages', 'i18n', 'messages', lang, 'common.json'),
      ).permissions
      for (const level of ['none', 'read', 'write', 'full']) {
        expect(words.level[level], `${lang} level.${level}`).toEqual(expect.any(String))
        expect(words.levelHint[level], `${lang} levelHint.${level}`).toEqual(expect.any(String))
      }
      for (const key of [
        'createRole',
        'deleteRole',
        'roleInUse',
        'templateReadonly',
        'ownerOnly',
        'startFrom',
        'startEmpty',
        'part',
      ]) {
        expect(words[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
      // The explainer of the old rule («base roles are not editable») is gone.
      expect(words.additiveTitle, lang).toBeUndefined()
    }
  })

  it('columns are the base roles and the business’s own — a template is only a starting point', () => {
    expect(view).toContain('const own = roles.filter((role) => role.isCustom)')
    expect(view).toContain(
      'const templates = useMemo(() => roles.filter((role) => role.isTemplate), [roles])',
    )
    expect(view).not.toContain('additiveTitle')
  })

  it('a role of your own can be made and deleted here', () => {
    expect(view).toContain('data-new-role=""')
    expect(view).toContain('onClick={() => onDeleteRole(role.id)}')
    const container = ui('permissions', 'containers', 'permissions-container.tsx')
    expect(container).toContain('useCreateCustomRole()')
    expect(container).toContain("includes('PERMISSION_ROLE_IN_USE')")
  })
})

describe('adding an employee asks ONE thing about access: the role', () => {
  const form = ui('team-and-payroll', 'team-and-payroll-view.tsx')
  const container = ui('team-and-payroll', 'containers', 'team-and-payroll-container.tsx')

  it('one select — the business’s own roles first, then the two every business has', () => {
    expect(form.split("t('team.memberRole'").length - 1).toBe(1)
    expect(form).toContain('value: `role:${profile.id}`,')
    expect(form).toContain("{ value: 'base:member', label: t('team.roleMember'")
    // The separate «سطح دسترسی» and «پروفایل دسترسی» questions are gone.
    expect(form).not.toContain("t('team.accessRole'")
    expect(form).not.toContain("t('team.permissionProfile'")
    expect(form).not.toContain("t('team.roleViewer'")
  })

  it('only a role made here is offered', () => {
    expect(container).toContain('.filter((role) => role.isCustom === true)')
  })

  it('the words exist in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json')).team
      for (const key of [
        'memberRole',
        'memberRoleHint',
        'memberRoleNoCustom',
        'roleMember',
        'roleAdmin',
      ]) {
        expect(words[key], `${lang} team.${key}`).toEqual(expect.any(String))
      }
    }
  })
})
