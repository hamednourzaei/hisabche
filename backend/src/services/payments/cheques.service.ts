import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { canTransitionCheque, tillMinorToMajor, type ChequeStatus } from '@hisabche/validation'
import { ConflictError } from '../../errors/database.error'
import { businessDayOf } from '../../utils/local-day'
import { PaymentsService } from './payments.service'

export class ChequesService {
  private paymentsService = new PaymentsService()

  async list(tenancy: TenancyContext, status?: string) {
    let q = supabase
      .from('cheques')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .order('due_date', { ascending: true })
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) throw new DatabaseError('Failed to list cheques', error)
    return data ?? []
  }

  async create(
    tenancy: TenancyContext,
    input: {
      direction: 'in' | 'out'
      cheque_number: string
      bank_name?: string | undefined
      due_date: string
      amount_minor: number
      currency: string
      payment_id?: string | undefined
      note?: string | undefined
    },
  ) {
    const initialStatus: ChequeStatus = input.direction === 'in' ? 'received' : 'issued'
    const { data, error } = await supabase
      .from('cheques')
      .insert({
        workspace_id: tenancy.workspaceId,
        direction: input.direction,
        cheque_number: input.cheque_number,
        bank_name: input.bank_name ?? null,
        due_date: input.due_date,
        amount_minor: input.amount_minor,
        currency: input.currency,
        status: initialStatus,
        payment_id: input.payment_id ?? null,
        note: input.note ?? null,
      })
      .select('*')
      .single()

    if (error || !data) throw new DatabaseError('Failed to register cheque', error)
    return data
  }

  async transition(
    tenancy: TenancyContext,
    chequeId: string,
    input: {
      status: ChequeStatus
      endorsed_to_supplier_id?: string | undefined
      note?: string | undefined
    },
  ) {
    const { data: cheque, error: findErr } = await supabase
      .from('cheques')
      .select('*')
      .eq('id', chequeId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()

    if (findErr || !cheque) throw new NotFoundError('Cheque not found')

    const check = canTransitionCheque(
      cheque.status as ChequeStatus,
      input.status,
      cheque.direction as 'in' | 'out',
    )
    if (!check.ok) {
      throw new ValidationError(check.code)
    }

    let endorsedPaymentId: string | null = cheque.endorsed_payment_id ?? null

    if (input.status === 'endorsed') {
      if (!input.endorsed_to_supplier_id) {
        throw new ValidationError('ENDORSED_SUPPLIER_REQUIRED')
      }
      if (endorsedPaymentId) {
        throw new ValidationError('CHEQUE_ALREADY_ENDORSED')
      }
      const endorsedPay = await this.paymentsService.recordPayment(
        tenancy,
        {
          direction: 'out',
          partyType: 'supplier',
          partyId: input.endorsed_to_supplier_id,
          // ⚠️ minor → major with the CURRENCY'S digits. This was `/ 100`: an
          // endorsed 5,000 AFN cheque (AFN has no minor unit) paid the supplier 50.
          amount: tillMinorToMajor(Number(cheque.amount_minor), String(cheque.currency)),
          currency: cheque.currency,
          method: 'cheque',
          reference: cheque.cheque_number,
          // The business's day, not the UTC date of the server's clock.
          entryDate: businessDayOf(new Date(), tenancy.timeZone),
          notes: input.note ?? `Endorsed cheque ${cheque.cheque_number}`,
        },
        {
          // One endorsement = one payment, even when the request is retried or
          // two people press the button at the same moment.
          clientRequestId: `cheque-endorse-${cheque.id}`,
        },
      )
      endorsedPaymentId = endorsedPay.id
    }

    if (input.status === 'bounced' && cheque.payment_id) {
      await this.paymentsService.cancelPayment(
        tenancy,
        cheque.payment_id,
        input.note ?? `Cheque ${cheque.cheque_number} bounced`,
      )
    }

    const nextEndorsedSupplierId = input.endorsed_to_supplier_id ?? cheque.endorsed_to_supplier_id
    const { data: updated, error: updErr } = await supabase
      .from('cheques')
      .update({
        status: input.status,
        endorsed_payment_id: endorsedPaymentId,
        endorsed_to_supplier_id: nextEndorsedSupplierId,
        note: input.note ?? cheque.note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cheque.id)
      .eq('workspace_id', tenancy.workspaceId)
      // Conditional: only from the state we checked. Someone else moving the
      // cheque in between is a conflict, never a silent second transition.
      .eq('status', cheque.status)
      .select('*')
      .maybeSingle()

    if (updErr) throw new DatabaseError('Failed to transition cheque', updErr)
    if (!updated) throw new ConflictError('CHEQUE_CHANGED')
    return updated
  }
}
