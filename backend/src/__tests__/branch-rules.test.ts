// ============================================
// Branches inside one business.
//
// The two things that must not drift: a branch NARROWS what the workspace
// already authorized and can never widen it, and a member with no assignment
// is unrestricted rather than locked out.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  branchAndDescendants,
  branchScopeFor,
  mayUseBranch,
  reportingBranchIds,
  resolveActiveBranch,
  validateBranchPlacement,
  type Branch,
} from '../services/branch'

const branch = (
  id: string,
  code: string,
  parentBranchId: string | null = null,
  isActive = true,
): Branch => ({
  id,
  workspaceId: 'ws-1',
  code,
  name: code,
  parentBranchId,
  isActive,
})

const kabul = branch('b-kabul', 'KBL')
const herat = branch('b-herat', 'HRT')
const all = [kabul, herat]

describe('an unassigned member is unrestricted, not locked out', () => {
  it('treats no assignment as access to everything', () => {
    // Most workspaces have one branch or none. Defaulting their members to no
    // access would have locked every existing user out the day this shipped.
    expect(branchScopeFor([])).toEqual({ kind: 'all' })
  })

  it('restricts a member who IS assigned', () => {
    expect(branchScopeFor(['b-kabul'])).toEqual({ kind: 'limited', branchIds: ['b-kabul'] })
  })

  it('deduplicates a repeated assignment', () => {
    expect(branchScopeFor(['b-kabul', 'b-kabul'])).toEqual({
      kind: 'limited',
      branchIds: ['b-kabul'],
    })
  })
})

describe('using a branch', () => {
  it('an unrestricted member may use any branch', () => {
    expect(mayUseBranch({ kind: 'all' }, 'b-herat')).toBe(true)
  })

  it('a restricted member may not use another branch', () => {
    expect(mayUseBranch({ kind: 'limited', branchIds: ['b-kabul'] }, 'b-herat')).toBe(false)
  })

  it('a restricted member does not own the workspace-wide rows', () => {
    // A row with no branch belongs to the business as a whole, and must not
    // appear in one shop's figures.
    expect(mayUseBranch({ kind: 'limited', branchIds: ['b-kabul'] }, null)).toBe(false)
  })

  it('an unrestricted member does see the workspace-wide rows', () => {
    expect(mayUseBranch({ kind: 'all' }, null)).toBe(true)
  })

  it('a scope of none allows nothing at all', () => {
    expect(mayUseBranch({ kind: 'none' }, 'b-kabul')).toBe(false)
  })
})

describe('resolving which branch a request acts in', () => {
  it('honours a requested branch the member is assigned to', () => {
    const resolved = resolveActiveBranch(
      { kind: 'limited', branchIds: ['b-kabul'] },
      'b-kabul',
      all,
    )
    expect(resolved).toEqual({ branchId: 'b-kabul' })
  })

  it('REFUSES a requested branch the member is not assigned to', () => {
    // The header is a target, not an authorization — exactly like a requested
    // workspace id.
    const resolved = resolveActiveBranch(
      { kind: 'limited', branchIds: ['b-kabul'] },
      'b-herat',
      all,
    )
    expect(resolved).toEqual({ error: 'BRANCH_NOT_PERMITTED' })
  })

  it('refuses a branch that does not exist in this workspace', () => {
    const resolved = resolveActiveBranch({ kind: 'all' }, 'b-somewhere-else', all)
    expect(resolved).toEqual({ error: 'BRANCH_NOT_PERMITTED' })
  })

  it('refuses a closed branch', () => {
    const closed = branch('b-old', 'OLD', null, false)
    const resolved = resolveActiveBranch({ kind: 'all' }, 'b-old', [...all, closed])
    expect(resolved).toEqual({ error: 'BRANCH_INACTIVE' })
  })

  it('picks the single branch a restricted member has, unasked', () => {
    // The till in a one-shop business should not have to name itself.
    const resolved = resolveActiveBranch({ kind: 'limited', branchIds: ['b-kabul'] }, null, all)
    expect(resolved).toEqual({ branchId: 'b-kabul' })
  })

  it('REFUSES to guess between several branches', () => {
    // Which shop a sale belongs to is not a decision the data can make.
    const resolved = resolveActiveBranch(
      { kind: 'limited', branchIds: ['b-kabul', 'b-herat'] },
      null,
      all,
    )
    expect(resolved).toEqual({ error: 'BRANCH_REQUIRED' })
  })

  it('acts across the whole workspace for an unrestricted member', () => {
    expect(resolveActiveBranch({ kind: 'all' }, null, all)).toEqual({ branchId: null })
  })
})

describe('the branch tree', () => {
  const region = branch('b-region', 'NORTH')
  const shopA = branch('b-a', 'A', 'b-region')
  const shopB = branch('b-b', 'B', 'b-region')
  const tree = [region, shopA, shopB, kabul]

  it('reporting on a region includes its shops', () => {
    expect(branchAndDescendants('b-region', tree).sort()).toEqual(['b-a', 'b-b', 'b-region'])
  })

  it('reporting on a leaf is just that leaf', () => {
    expect(branchAndDescendants('b-a', tree)).toEqual(['b-a'])
  })

  it('survives a cycle in the stored data rather than hanging', () => {
    const cyclic = [branch('x', 'X', 'y'), branch('y', 'Y', 'x')]
    expect(branchAndDescendants('x', cyclic).sort()).toEqual(['x', 'y'])
  })

  it('a report with no branch requested covers everything for an unrestricted member', () => {
    expect(reportingBranchIds({ kind: 'all' }, null, tree)).toBeNull()
  })

  it("a restricted member's report covers only their branches", () => {
    expect(reportingBranchIds({ kind: 'limited', branchIds: ['b-a'] }, null, tree)).toEqual(['b-a'])
  })

  it('a requested branch expands down the tree', () => {
    expect(reportingBranchIds({ kind: 'all' }, 'b-region', tree)?.sort()).toEqual([
      'b-a',
      'b-b',
      'b-region',
    ])
  })
})

describe('branch placement', () => {
  it('rejects a duplicate code', () => {
    expect(validateBranchPlacement({ id: '', code: 'KBL', parentBranchId: null }, all)).toContain(
      'BRANCH_CODE_DUPLICATE',
    )
  })

  it('rejects an unknown parent', () => {
    expect(validateBranchPlacement({ id: '', code: 'NEW', parentBranchId: 'nope' }, all)).toContain(
      'BRANCH_PARENT_UNKNOWN',
    )
  })

  it('rejects a branch made its own parent', () => {
    expect(
      validateBranchPlacement({ id: 'b-kabul', code: 'KBL', parentBranchId: 'b-kabul' }, all),
    ).toContain('BRANCH_SELF_PARENT')
  })

  it('rejects a cycle', () => {
    const child = branch('b-child', 'CHILD', 'b-kabul')
    expect(
      validateBranchPlacement({ id: 'b-kabul', code: 'KBL', parentBranchId: 'b-child' }, [
        ...all,
        child,
      ]),
    ).toContain('BRANCH_PARENT_CYCLE')
  })

  it('accepts a well-placed branch', () => {
    expect(
      validateBranchPlacement({ id: '', code: 'MZR', parentBranchId: 'b-kabul' }, all),
    ).toEqual([])
  })
})
