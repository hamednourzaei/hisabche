import { z } from 'zod'

export const APPROVAL_POLICY_DOC_TYPES = [
  'purchase_order',
  'stock_transfer',
  'stock_write_off',
  'supplier_payment_mismatch',
  'journal_entry',
] as const

export type ApprovalPolicyDocType = (typeof APPROVAL_POLICY_DOC_TYPES)[number]

export const approvalPolicyStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  approverRoles: z.array(z.string().min(1)).min(1),
})

export const upsertApprovalPolicySchema = z.object({
  id: z.string().uuid().optional(),
  document_type: z.enum(APPROVAL_POLICY_DOC_TYPES),
  name: z.string().min(1).max(160),
  min_amount_minor: z.number().int().nonnegative().nullable().optional(),
  reasons: z.array(z.string().min(1)).nullable().optional(),
  warehouse_ids: z.array(z.string().uuid()).nullable().optional(),
  steps: z.array(approvalPolicyStepSchema).min(1),
  is_active: z.boolean().optional(),
})

export const decideApprovalPolicyRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
})

export type ApprovalPolicyStep = z.infer<typeof approvalPolicyStepSchema>

export interface ApprovalPolicyRule {
  id: string
  document_type: ApprovalPolicyDocType
  min_amount_minor: number | null
  reasons: string[] | null
  warehouse_ids: string[] | null
  steps: ApprovalPolicyStep[]
  is_active: boolean
}

export interface ApprovalEvaluationContext {
  documentType: ApprovalPolicyDocType
  amountMinor?: number | null | undefined
  reason?: string | null | undefined
  warehouseId?: string | null | undefined
}

export function matchApprovalPolicy(
  policies: readonly ApprovalPolicyRule[],
  ctx: ApprovalEvaluationContext,
): ApprovalPolicyRule | null {
  const candidates = policies.filter((p) => {
    if (!p.is_active || p.document_type !== ctx.documentType || p.steps.length === 0) {
      return false
    }
    if (p.min_amount_minor !== null && p.min_amount_minor !== undefined) {
      const amt = Math.abs(ctx.amountMinor ?? 0)
      if (amt < p.min_amount_minor) return false
    }
    if (p.reasons && p.reasons.length > 0) {
      if (!ctx.reason || !p.reasons.includes(ctx.reason)) return false
    }
    if (p.warehouse_ids && p.warehouse_ids.length > 0) {
      if (!ctx.warehouseId || !p.warehouse_ids.includes(ctx.warehouseId)) return false
    }
    return true
  })

  if (candidates.length === 0) return null
  // Highest amount threshold wins, then most steps.
  candidates.sort((a, b) => {
    const amtDiff = (b.min_amount_minor ?? 0) - (a.min_amount_minor ?? 0)
    if (amtDiff !== 0) return amtDiff
    return b.steps.length - a.steps.length
  })
  return candidates[0] ?? null
}

export function validateApprovalDecision(params: {
  requesterId: string
  actorId: string
  actorRole: string
  requestStatus: 'pending' | 'approved' | 'rejected'
  currentStep: number
  steps: readonly ApprovalPolicyStep[]
}):
  { ok: true; nextStep: number; nextStatus: 'pending' | 'approved' } | { ok: false; code: string } {
  if (params.requestStatus !== 'pending') {
    return { ok: false, code: 'APPROVAL_REQUEST_ALREADY_CLOSED' }
  }
  if (params.requesterId === params.actorId) {
    return { ok: false, code: 'SELF_APPROVAL_REFUSED' }
  }
  const stepDef = params.steps.find((s) => s.stepNumber === params.currentStep)
  if (!stepDef) {
    return { ok: false, code: 'APPROVAL_STEP_NOT_FOUND' }
  }
  if (!stepDef.approverRoles.includes(params.actorRole)) {
    return { ok: false, code: 'APPROVER_ROLE_FORBIDDEN' }
  }
  const isLastStep = params.currentStep >= params.steps.length
  return {
    ok: true,
    nextStep: isLastStep ? params.currentStep : params.currentStep + 1,
    nextStatus: isLastStep ? 'approved' : 'pending',
  }
}
