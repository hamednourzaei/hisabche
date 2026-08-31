// ============================================
// Subject + Resource + Action + Scope.
//
// The fourth question the authorization domain did not answer: WHERE. A sales
// manager for Kabul and Herat holding `invoice.update` still has no business
// editing Kandahar's invoices.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  authorize,
  branchFilterFor,
  mayWriteToBranch,
  type ActorScope,
} from '../services/authorization/scope.domain'

const SHOP = 'ws-1'
const OTHER = 'ws-2'
const KABUL = 'br-kabul'
const HERAT = 'br-herat'
const KANDAHAR = 'br-kandahar'

const actor = (over: Partial<ActorScope> = {}): ActorScope => ({
  workspaceId: SHOP,
  userId: 'u-1',
  role: 'manager',
  branchIds: [],
  ...over,
})

const resource = (over: Partial<Parameters<typeof authorize>[0]['resource']> = {}) => ({
  workspaceId: SHOP,
  branchId: null,
  ...over,
})

const ask = (
  a: ActorScope,
  r: ReturnType<typeof resource>,
  action: Parameters<typeof authorize>[0]['action'] = 'invoice.update',
  resourceType = 'invoice',
) => authorize({ actor: a, resource: r, action, resourceType })

describe('tenancy is checked first, and told first', () => {
  it('refuses another workspace', () => {
    expect(ask(actor(), resource({ workspaceId: OTHER }))).toEqual({
      allowed: false,
      reason: 'WRONG_WORKSPACE',
    })
  })

  it('reports a wrong workspace as a workspace problem, never a branch one', () => {
    // Saying "out of branch scope" would confirm to an outsider that the
    // resource exists and merely sits elsewhere.
    const decision = ask(
      actor({ branchIds: [KABUL] }),
      resource({ workspaceId: OTHER, branchId: KANDAHAR }),
    )
    expect(decision).toMatchObject({ reason: 'WRONG_WORKSPACE' })
  })
})

describe('capability', () => {
  it('refuses a seller the ledger', () => {
    expect(ask(actor({ role: 'seller' }), resource(), 'ledger.post')).toEqual({
      allowed: false,
      reason: 'MISSING_CAPABILITY',
    })
  })

  it('allows an owner everything the role holds', () => {
    expect(ask(actor({ role: 'owner' }), resource(), 'ledger.reverse')).toEqual({ allowed: true })
  })
})

describe('branch scope', () => {
  it('refuses a branch the actor is not assigned to', () => {
    expect(ask(actor({ branchIds: [KABUL, HERAT] }), resource({ branchId: KANDAHAR }))).toEqual({
      allowed: false,
      reason: 'OUT_OF_BRANCH_SCOPE',
    })
  })

  it('allows one they are', () => {
    expect(ask(actor({ branchIds: [KABUL, HERAT] }), resource({ branchId: HERAT }))).toEqual({
      allowed: true,
    })
  })

  it('treats NO assignment as unrestricted, not as locked out', () => {
    // The settled decision: the day branch scoping shipped, the alternative
    // was that every existing member in every existing workspace lost access
    // to everything at once.
    expect(ask(actor({ branchIds: [] }), resource({ branchId: KANDAHAR }))).toEqual({
      allowed: true,
    })
  })

  it('lets a scoped actor see rows that belong to no branch', () => {
    // Workspace-level settings, and everything created before branches
    // existed. Hiding them would hide the shop's own history.
    expect(ask(actor({ branchIds: [KABUL] }), resource({ branchId: null }))).toEqual({
      allowed: true,
    })
  })
})

describe('record ownership', () => {
  it("refuses a seller another seller's invoice", () => {
    expect(
      ask(actor({ role: 'seller', userId: 'u-1' }), resource({ ownerId: 'u-2' }), 'invoice.update'),
    ).toEqual({ allowed: false, reason: 'NOT_OWN_RECORD' })
  })

  it('allows a seller their own', () => {
    expect(
      ask(actor({ role: 'seller', userId: 'u-1' }), resource({ ownerId: 'u-1' }), 'invoice.update'),
    ).toEqual({ allowed: true })
  })

  it('lets a manager act on a row somebody else created', () => {
    // The normal running of a shop.
    expect(ask(actor({ role: 'manager', userId: 'u-1' }), resource({ ownerId: 'u-2' }))).toEqual({
      allowed: true,
    })
  })

  it('keeps the shared catalogue shared', () => {
    expect(
      ask(
        actor({ role: 'seller', userId: 'u-1' }),
        resource({ ownerId: 'u-2' }),
        'product.read',
        'product',
      ),
    ).toEqual({ allowed: true })
  })
})

describe('the filter a query should apply', () => {
  it('returns null for an unrestricted actor, NOT an empty list', () => {
    // An empty array would be a filter matching nothing — the dangerous way
    // to get this wrong, because it fails quiet: an empty list looks like an
    // empty shop rather than like a bug.
    expect(branchFilterFor(actor({ branchIds: [] }))).toBeNull()
  })

  it('returns the branches for a scoped one', () => {
    expect(branchFilterFor(actor({ branchIds: [KABUL] }))).toEqual([KABUL])
  })
})

describe('writing into a branch', () => {
  it('refuses a scoped member filing into a branch they do not hold', () => {
    // Without this, scope would only ever be checked on read, and a Kabul
    // member could file a Herat invoice they then could not see.
    expect(mayWriteToBranch(actor({ branchIds: [KABUL] }), HERAT)).toBe(false)
  })

  it('allows an unassigned member anywhere', () => {
    expect(mayWriteToBranch(actor({ branchIds: [] }), HERAT)).toBe(true)
  })

  it('allows a workspace-level write', () => {
    expect(mayWriteToBranch(actor({ branchIds: [KABUL] }), null)).toBe(true)
  })
})
