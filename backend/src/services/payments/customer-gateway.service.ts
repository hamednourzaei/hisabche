import { createHmac, timingSafeEqual } from 'node:crypto'
import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { PaymentsService } from './payments.service'

export interface CustomerGatewayAdapter {
  readonly provider: string
  readonly configured: boolean
  readonly webhookSecret: string | null
}

export function verifyGatewayHmacSignature(
  rawBody: string,
  signatureHex: string,
  secret: string,
): boolean {
  if (!secret || !signatureHex) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signatureHex, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export class CustomerGatewayService {
  private paymentsService = new PaymentsService()

  async handlePaidWebhook(
    tenancy: TenancyContext,
    adapter: CustomerGatewayAdapter,
    params: {
      rawBody: string
      signatureHex: string
      externalEventId: string
      customerId: string
      invoiceId?: string | undefined
      amountMinor: number
      currency: string
    },
  ) {
    if (!adapter.configured || !adapter.webhookSecret) {
      throw new ValidationError('BLOCKED_EXTERNAL_CREDENTIAL')
    }

    if (!verifyGatewayHmacSignature(params.rawBody, params.signatureHex, adapter.webhookSecret)) {
      throw new ValidationError('GATEWAY_SIGNATURE_INVALID')
    }

    // Replay check
    const { data: existing } = await supabase
      .from('payment_gateway_events')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('provider', adapter.provider)
      .eq('external_event_id', params.externalEventId)
      .maybeSingle()

    if (existing) {
      return { replayed: true, event: existing }
    }

    const payment = await this.paymentsService.recordPayment(tenancy, {
      direction: 'in',
      partyType: 'customer',
      partyId: params.customerId,
      amount: params.amountMinor / 100,
      currency: params.currency,
      method: 'card',
      reference: `gw-${adapter.provider}-${params.externalEventId}`,
      entryDate: new Date().toISOString().slice(0, 10),
      allocations: params.invoiceId
        ? [{ invoiceId: params.invoiceId, amount: params.amountMinor / 100 }]
        : undefined,
    })

    const { data: event, error } = await supabase
      .from('payment_gateway_events')
      .insert({
        workspace_id: tenancy.workspaceId,
        provider: adapter.provider,
        external_event_id: params.externalEventId,
        invoice_id: params.invoiceId ?? null,
        amount_minor: params.amountMinor,
        currency: params.currency,
        payment_id: payment.id,
        status: 'processed',
      })
      .select('*')
      .single()

    if (error || !event) throw new DatabaseError('Failed to record gateway webhook event', error)
    return { replayed: false, event }
  }
}

export const customerGatewayService = new CustomerGatewayService()
