// ============================================
// MODULE PERMISSION — a declared rule must actually be asked.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS LOCKS DOWN
//
// `scope.service.ts` carries a SHAPE table naming every resource whose rows are
// guarded by branch and by creator. Four resources are listed. Three of them —
// invoice, customer, product — call `scopes.assertMay` on their mutations.
// `payment` did not, and the operation it did not guard was `cancelPayment`,
// which reverses a posted ledger entry.
//
// Tenancy was never broken: `getPayment` filters by `workspace_id`. What was
// missing is the delegation INSIDE a workspace. A member pinned to the Kabul
// branch could cancel a Herat payment by knowing its id, and the branch rule in
// `scope.domain.ts` applies to managers and owners too — it is not a
// seller-only restriction.
//
// ⚠️ THE SoD CHECK IS NOT THE SAME CONTROL. `sod.assertAllowed` asks "did you
// record this yourself"; the scope guard asks "is this yours to touch". A
// manager cancelling a colleague's payment in another branch passes SoD
// cleanly, which is why the presence of one hid the absence of the other.
//
// ---------------------------------------------------------------------------
// THE SHAPE OF THIS FILE
//
// The first suite tests the pure decision function — real inputs, real
// branches. The second reads the services and asserts that the ones declaring
// a guarded resource actually invoke the guard, because "the rule exists and
// nothing calls it" is the failure that happened and no unit test of the rule
// itself would have caught it.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  authorize,
  mayWriteToBranch,
  type ActorScope,
} from '../services/authorization/scope.domain'

const SRC = join(__dirname, '..')

/** Comments stripped — every one of these rules is discussed in comments. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const KABUL = 'b-kabul'
const HERAT = 'b-herat'
const WS = 'ws-1'

function actor(role: ActorScope['role'], branchIds: string[], userId = 'u-1'): ActorScope {
  return { workspaceId: WS, userId, role, branchIds }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('the branch rule binds every role', () => {
  it('⚠️ a MANAGER pinned to one branch cannot act on another', () => {
    // The reason the payment gap mattered. It is tempting to assume branch
    // scope is a junior-staff restriction; it is not, and `scope.domain.ts`
    // asks `mayUseBranch` before it looks at the role at all.
    const decision = authorize({
      actor: actor('manager', [KABUL]),
      resource: { workspaceId: WS, branchId: HERAT, ownerId: 'u-2' },
      resourceType: 'payment',
      action: 'payment.cancel',
    })
    expect(decision).toEqual({ allowed: false, reason: 'OUT_OF_BRANCH_SCOPE' })
  })

  it('⚠️ an OWNER pinned to one branch cannot act on another either', () => {
    const decision = authorize({
      actor: actor('owner', [KABUL]),
      resource: { workspaceId: WS, branchId: HERAT, ownerId: 'u-2' },
      resourceType: 'payment',
      action: 'payment.cancel',
    })
    expect(decision).toEqual({ allowed: false, reason: 'OUT_OF_BRANCH_SCOPE' })
  })

  it('an unassigned member is unrestricted, not locked out', () => {
    // Empty assignment means "not pinned". Reading it as "no branches" would
    // lock every existing member out on the day branches shipped.
    const decision = authorize({
      actor: actor('manager', []),
      resource: { workspaceId: WS, branchId: HERAT, ownerId: 'u-2' },
      resourceType: 'payment',
      action: 'payment.cancel',
    })
    expect(decision).toEqual({ allowed: true })
  })

  it('a pinned member may act within their own branch', () => {
    const decision = authorize({
      actor: actor('manager', [KABUL]),
      resource: { workspaceId: WS, branchId: KABUL, ownerId: 'u-2' },
      resourceType: 'payment',
      action: 'payment.cancel',
    })
    expect(decision).toEqual({ allowed: true })
  })
})

describe('the order of refusals', () => {
  it('⚠️ a foreign workspace is never described as a branch problem', () => {
    // Saying "wrong branch" would confirm the row exists to somebody outside
    // the workspace entirely.
    const decision = authorize({
      actor: actor('owner', [KABUL]),
      resource: { workspaceId: 'ws-2', branchId: HERAT, ownerId: 'u-2' },
      resourceType: 'payment',
      action: 'payment.cancel',
    })
    expect(decision).toEqual({ allowed: false, reason: 'WRONG_WORKSPACE' })
  })

  it('a missing capability is reported before a branch mismatch', () => {
    // A seller holds no `payment.cancel` anywhere; telling them the branch is
    // wrong would send them to fix the wrong thing.
    const decision = authorize({
      actor: actor('seller', [KABUL]),
      resource: { workspaceId: WS, branchId: HERAT, ownerId: 'u-1' },
      resourceType: 'payment',
      action: 'payment.cancel',
    })
    expect(decision).toEqual({ allowed: false, reason: 'MISSING_CAPABILITY' })
  })

  it("a seller is refused another seller's own-record resource", () => {
    const decision = authorize({
      actor: actor('seller', [], 'u-1'),
      resource: { workspaceId: WS, branchId: null, ownerId: 'u-2' },
      resourceType: 'invoice',
      action: 'invoice.update',
    })
    expect(decision).toEqual({ allowed: false, reason: 'NOT_OWN_RECORD' })
  })

  it("the shared catalogue is shared — a seller may edit another's customer", () => {
    // A shop with one catalogue where each seller saw a different half of it
    // would be unusable.
    const decision = authorize({
      actor: actor('seller', [], 'u-1'),
      resource: { workspaceId: WS, branchId: null, ownerId: 'u-2' },
      resourceType: 'customer',
      action: 'customer.write',
    })
    expect(decision).toEqual({ allowed: true })
  })
})

describe('writing into a branch', () => {
  it('a pinned member cannot file into another branch', () => {
    expect(mayWriteToBranch(actor('manager', [KABUL]), HERAT)).toBe(false)
  })

  it('a pinned member may file a workspace-level row', () => {
    // Unlike reading, it exposes no other branch's data.
    expect(mayWriteToBranch(actor('manager', [KABUL]), null)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('every guarded resource actually calls the guard', () => {
  const scopeService = code(join(SRC, 'services', 'authorization', 'scope.service.ts'))

  /** The resources `scope.service.ts` declares it guards. */
  function declaredResources(): string[] {
    const shape = scopeService.slice(
      scopeService.indexOf('const SHAPE'),
      scopeService.indexOf('function refuse'),
    )
    return [...shape.matchAll(/^\s{2}(\w+):\s*\{\s*table:/gm)].map((m) => m[1]!)
  }

  /** Every `.ts` file under services/, so a new caller is found automatically. */
  function serviceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) serviceFiles(full, out)
      else if (entry.endsWith('.ts') && !entry.includes('.test.')) out.push(full)
    }
    return out
  }

  const callers = serviceFiles(join(SRC, 'services'))
    .filter((f) => !f.includes(join('services', 'authorization')))
    .map((f) => code(f))
    .join('\n')

  it('read a real SHAPE table', () => {
    // A rename that emptied this would make the rule below vacuous.
    expect(declaredResources().sort()).toEqual(['customer', 'invoice', 'payment', 'product'])
  })

  it('⚠️ no resource is declared guarded and then never checked', () => {
    const unused = declaredResources().filter(
      (resource) => !new RegExp(`assertMay\\(\\s*ctx,\\s*'${resource}'`).test(callers),
    )

    expect(
      unused,
      'these resources are listed in scope.service.ts SHAPE but no service asks the guard — the rule exists and does nothing',
    ).toEqual([])
  })

  it('⚠️ cancelling a payment is scope-checked, not only SoD-checked', () => {
    // Named explicitly: this is the operation that was missing it, and the two
    // controls answer different questions.
    const payments = code(join(SRC, 'services', 'payments', 'payments.service.ts'))
    const cancel = payments.slice(
      payments.indexOf('async cancelPayment'),
      payments.indexOf('async getAging'),
    )
    expect(cancel).toMatch(/scopes\.assertMay\(ctx, 'payment', paymentId, 'payment\.cancel'\)/)
    expect(cancel).toMatch(/sod\.assertAllowed/)
  })

  it('the scope check runs BEFORE the maker-checker rule', () => {
    // Reaching SoD first reports the wrong reason and offers an override for a
    // control that was not the obstacle.
    const payments = code(join(SRC, 'services', 'payments', 'payments.service.ts'))
    const cancel = payments.slice(
      payments.indexOf('async cancelPayment'),
      payments.indexOf('async getAging'),
    )
    expect(cancel.indexOf('scopes.assertMay')).toBeLessThan(cancel.indexOf('sod.assertAllowed'))
  })
})
