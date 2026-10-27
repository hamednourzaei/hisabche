// An owner with two workspaces has `user.role === null` in the auth store
// (display-only, «not unambiguous»). The industry selector used to read that as
// «not an owner» and disabled every box. The server decides; the screen locks
// only a role it knows cannot write.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { industryEditable } from '../lib/industry-edit-access'

const component = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'settings', 'industry-profile-section.tsx'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('industryEditable', () => {
  it('lets an owner edit', () => {
    expect(industryEditable('owner')).toBe(true)
  })

  it('does not lock a person whose role is not known or not unambiguous', () => {
    expect(industryEditable(null)).toBe(true)
    expect(industryEditable(undefined)).toBe(true)
    expect(industryEditable('')).toBe(true)
  })

  it('locks a role that is known not to be the owner', () => {
    expect(industryEditable('admin')).toBe(false)
    expect(industryEditable('member')).toBe(false)
    expect(industryEditable('viewer')).toBe(false)
  })

  it('does not report «saved» when the server answered 200 but kept nothing', () => {
    // The profile endpoint drops `businessTypes` silently on a database without
    // the onboarding columns and replies with an empty list; the store merges
    // that reply, so the store is the truth after the call.
    expect(component).toContain('useAuthStore.getState().user?.businessTypes')
    expect(component).toContain('settings.industryNotPersisted')
    const afterUpdate = component.slice(component.indexOf('await updateProfile('))
    expect(afterUpdate.indexOf('industryNotPersisted')).toBeLessThan(
      afterUpdate.indexOf('setSaved(true)'),
    )
  })

  it('is the gate the Settings section actually uses', () => {
    expect(component).toContain('industryEditable(storeRole)')
    expect(component).not.toContain("storeRole === 'owner'")
  })
})
