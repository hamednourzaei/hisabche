import { describe, expect, it } from 'vitest'
import {
  matchApprovalPolicy,
  validateApprovalDecision,
  type ApprovalPolicyRule,
} from '@hisabche/validation'

describe('B.2.7 Unified approval policy', () => {
  const poPolicy: ApprovalPolicyRule = {
    id: 'pol-1',
    document_type: 'purchase_order',
    min_amount_minor: 500_000,
    reasons: null,
    warehouse_ids: null,
    steps: [
      { stepNumber: 1, approverRoles: ['manager'] },
      { stepNumber: 2, approverRoles: ['owner'] },
    ],
    is_active: true,
  }

  it('leaves uncovered documents unaffected (returns null)', () => {
    expect(
      matchApprovalPolicy([poPolicy], { documentType: 'purchase_order', amountMinor: 100_000 }),
    ).toBeNull()
    expect(
      matchApprovalPolicy([poPolicy], { documentType: 'stock_transfer', amountMinor: 900_000 }),
    ).toBeNull()
  })

  it('refuses self-approval', () => {
    const res = validateApprovalDecision({
      requesterId: 'u-1',
      actorId: 'u-1',
      actorRole: 'manager',
      requestStatus: 'pending',
      currentStep: 1,
      steps: poPolicy.steps,
    })
    expect(res).toEqual({ ok: false, code: 'SELF_APPROVAL_REFUSED' })
  })

  it('advances multi-step approval from step 1 (pending) to step 2 (approved)', () => {
    const step1 = validateApprovalDecision({
      requesterId: 'u-req',
      actorId: 'u-mgr',
      actorRole: 'manager',
      requestStatus: 'pending',
      currentStep: 1,
      steps: poPolicy.steps,
    })
    expect(step1).toEqual({ ok: true, nextStep: 2, nextStatus: 'pending' })

    const step2 = validateApprovalDecision({
      requesterId: 'u-req',
      actorId: 'u-own',
      actorRole: 'owner',
      requestStatus: 'pending',
      currentStep: 2,
      steps: poPolicy.steps,
    })
    expect(step2).toEqual({ ok: true, nextStep: 2, nextStatus: 'approved' })
  })

  it('refuses acting on an already rejected/closed request', () => {
    const res = validateApprovalDecision({
      requesterId: 'u-req',
      actorId: 'u-own',
      actorRole: 'owner',
      requestStatus: 'rejected',
      currentStep: 1,
      steps: poPolicy.steps,
    })
    expect(res).toEqual({ ok: false, code: 'APPROVAL_REQUEST_ALREADY_CLOSED' })
  })
})
