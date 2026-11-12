import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'
import { enqueueEmail } from '../email-outbox'

export interface SmsProviderAdapter {
  readonly configured: boolean
  sendSms(to: string, templateKey: string, params: Record<string, unknown>): Promise<void>
}

const UNCONFIGURED_SMS_PROVIDER: SmsProviderAdapter = {
  configured: false,
  async sendSms() {
    throw new Error('BLOCKED_EXTERNAL_CREDENTIAL: SMS provider is not configured')
  },
}

export class MessagingOutboxService {
  constructor(private readonly smsProvider: SmsProviderAdapter = UNCONFIGURED_SMS_PROVIDER) {}

  async enqueue(
    tenancy: TenancyContext,
    input: {
      channel: 'email' | 'sms'
      customerId?: string | undefined
      recipient: string
      templateKey: string
      templateParams?: Record<string, unknown> | undefined
      idempotencyKey: string
    },
  ) {
    if (input.channel === 'sms' && input.customerId) {
      const { data: cust } = await supabase
        .from('customers')
        .select('sms_opt_out')
        .eq('id', input.customerId)
        .eq('workspace_id', tenancy.workspaceId)
        .maybeSingle()

      if (cust?.sms_opt_out === true) {
        const { data: skipped } = await supabase
          .from('messaging_outbox')
          .upsert(
            {
              workspace_id: tenancy.workspaceId,
              channel: 'sms',
              customer_id: input.customerId,
              recipient: input.recipient,
              template_key: input.templateKey,
              template_params: input.templateParams ?? {},
              idempotency_key: input.idempotencyKey,
              status: 'skipped_opt_out',
            },
            { onConflict: 'workspace_id,idempotency_key' },
          )
          .select('*')
          .single()
        return skipped
      }
    }

    const { data: row, error } = await supabase
      .from('messaging_outbox')
      .upsert(
        {
          workspace_id: tenancy.workspaceId,
          channel: input.channel,
          customer_id: input.customerId ?? null,
          recipient: input.recipient,
          template_key: input.templateKey,
          template_params: input.templateParams ?? {},
          idempotency_key: input.idempotencyKey,
          status:
            input.channel === 'sms' && !this.smsProvider.configured
              ? 'blocked_no_provider'
              : 'pending',
        },
        { onConflict: 'workspace_id,idempotency_key' },
      )
      .select('*')
      .single()

    if (error || !row) throw new DatabaseError('Failed to enqueue message', error)

    if (input.channel === 'email' && row.status === 'pending') {
      await enqueueEmail(
        input.recipient,
        input.templateKey,
        JSON.stringify(input.templateParams ?? {}),
      )
      await supabase
        .from('messaging_outbox')
        .update({ status: 'sent', attempts: 1, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('workspace_id', tenancy.workspaceId)
      return { ...row, status: 'sent' }
    }

    if (input.channel === 'sms' && this.smsProvider.configured && row.status === 'pending') {
      try {
        await this.smsProvider.sendSms(
          input.recipient,
          input.templateKey,
          input.templateParams ?? {},
        )
        await supabase
          .from('messaging_outbox')
          .update({
            status: 'sent',
            attempts: row.attempts + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('workspace_id', tenancy.workspaceId)
        return { ...row, status: 'sent' }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await supabase
          .from('messaging_outbox')
          .update({
            status: 'failed',
            attempts: row.attempts + 1,
            last_error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id)
          .eq('workspace_id', tenancy.workspaceId)
        return { ...row, status: 'failed', last_error: msg }
      }
    }

    return row
  }
}

export const messagingOutboxService = new MessagingOutboxService()
