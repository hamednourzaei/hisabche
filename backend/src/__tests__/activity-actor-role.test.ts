// ============================================
// The role attached to each activity in the feed.
//
// ---------------------------------------------------------------------------
// WHAT THESE GUARD
//
// 1. NO FAKE BACKFILL. An actor with no CURRENT membership — they left, their
//    access was revoked, or the row predates memberships — has no role, and
//    the feed says so. Defaulting to `member` or `viewer` would put a false
//    statement about a real person on the dashboard, and «viewer» is the
//    tempting default precisely because it looks harmless.
//
// 2. `workspace_id` IS THE BOUNDARY. The role lookup is scoped to the
//    workspace that owns the activity. `user_id` narrows it to the actors
//    about to be rendered; it is never the security filter. Without the
//    workspace predicate the query returns a person's role in somebody else's
//    business.
//
// 3. THE FEED IS NOT SLOWED BY A QUERY PER ROW. One lookup for the page, not
//    one per activity — the same lesson `getEntitySummary` already learned
//    here after a 3.5-second dashboard.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { toActorRole } from '../services/activity.service'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
}

const service = code(join(__dirname, '..', 'services', 'activity.service.ts'))

describe('a stored role is translated, never guessed', () => {
  it('the client vocabulary passes through', () => {
    expect(toActorRole('owner')).toBe('owner')
    expect(toActorRole('admin')).toBe('admin')
    expect(toActorRole('member')).toBe('member')
    expect(toActorRole('viewer')).toBe('viewer')
  })

  it('the server vocabulary is translated — two vocabularies, one column', () => {
    expect(toActorRole('manager')).toBe('admin')
    expect(toActorRole('seller')).toBe('member')
  })

  it('⚠️ anything else is UNKNOWN, not the lowest role', () => {
    expect(toActorRole(null)).toBeNull()
    expect(toActorRole(undefined)).toBeNull()
    expect(toActorRole('')).toBeNull()
    expect(toActorRole('accountant')).toBeNull()
    expect(toActorRole(42)).toBeNull()
  })
})

describe('the role is resolved server-side, inside the tenancy boundary', () => {
  it('the lookup filters on workspace_id', () => {
    expect(service).toMatch(/from\('workspace_members'\)[\s\S]{0,200}?\.eq\('workspace_id'/)
  })

  it('user_id narrows the lookup and is never the boundary', () => {
    // `.in('user_id', …)` selects WHICH actors to name. There is no
    // `.eq('user_id', …)` standing in for a workspace filter.
    expect(service).toMatch(/\.in\('user_id', ids\)/)
  })

  it('only a current membership counts', () => {
    expect(service).toMatch(/\.eq\('has_access', true\)/)
    expect(service).toMatch(/\.is\('suspended_at', null\)/)
  })

  it('⚠️ a missing membership yields null, never a substituted role', () => {
    expect(service).toMatch(/actorRoles\.get\(item\.actor_id\) \?\? null/)
    expect(service).not.toMatch(/actorRole:[^\n]*\?\?\s*'(member|viewer|owner|admin)'/)
  })

  it('one query for the page, not one per activity', () => {
    expect(service).toMatch(/const actorRoles = await resolveActorRoles\(/)
    // If the resolver moved inside the row loop it would be awaited per item.
    expect(service).not.toMatch(/for \([^)]*\) \{\s*const \w+ = await resolveActorRoles/)
  })
})
