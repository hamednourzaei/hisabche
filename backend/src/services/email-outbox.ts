// ============================================
// backend/src/services/email-outbox.ts
//
// Emails that survive a crash and are sent by exactly one instance at a time.
//
// Every guarantee lives in Postgres (docs/email-outbox-migration.sql): the row
// is written BEFORE anything is sent, a claim is one statement with FOR UPDATE
// SKIP LOCKED, and only the holder of a claim may finish it. This module only
// calls those functions.
//
//   send()  → enqueue (durable) → claim THAT row → send → complete / fail
//   poller  → claim due rows (retries, and rows whose sender died) → same
//
// Before the migration the table does not exist. That is reported as `null`
// ("not configured") and emailService keeps its in-process queue — correct
// for ONE instance only.
//
// Knows nothing about the email provider: the sender is passed in, which also
// keeps this module free of an import cycle with email.service.
// ============================================

import { supabase } from '../db'
import { WORKER_ID } from './distributed-work'

/** How long a claim is held before another instance may send the email again. */
export const EMAIL_LEASE_SECONDS = 120

/** Spacing between sends from one drain, for the provider's rate limit. */
const SEND_SPACING_MS = 200

export interface OutboxEmail {
  id: string
  to_email: string
  subject: string
  html: string | null
  attempts: number
  max_attempts: number
}

export interface SendResult {
  success: boolean
  id?: string | undefined
  error?: unknown
}

/** Sends one email. `idempotencyKey` is the outbox row id — a retry is not a second email. */
export type EmailSender = (email: {
  to: string
  subject: string
  html: string
  idempotencyKey: string
}) => Promise<SendResult>

export type Delivery = 'sent' | 'retry' | 'failed' | 'lost'

function isNotConfigured(error: { code?: string } | null): boolean {
  // Table missing (42P01 / PGRST205) or function missing (42883 / PGRST202).
  return !!error && ['42P01', 'PGRST205', '42883', 'PGRST202'].includes(error.code ?? '')
}

/** Write the email down. Its id, or `null` when the outbox is not installed yet. */
export async function enqueueEmail(
  to: string,
  subject: string,
  html: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('email_outbox')
    .insert({ to_email: to, subject, html })
    .select('id')
    .single()
  if (isNotConfigured(error)) return null
  if (error) throw error
  return (data as { id: string }).id
}

/** Claim due emails — or the one with `id`. `null` when not installed. */
export async function claimEmails(
  limit: number,
  id: string | null = null,
): Promise<OutboxEmail[] | null> {
  const { data, error } = await supabase.rpc('claim_email_outbox', {
    p_worker: WORKER_ID,
    p_limit: limit,
    p_lease_seconds: EMAIL_LEASE_SECONDS,
    p_id: id,
  })
  if (isNotConfigured(error)) return null
  if (error) throw error
  return (data ?? []) as OutboxEmail[]
}

/** 1 min, 2, 4, 8 … capped at an hour. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 3600)
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/**
 * Send a claimed email and record the outcome as its holder.
 * 'lost' = this instance's lease had expired and another instance holds it now.
 */
export async function deliverClaimed(email: OutboxEmail, send: EmailSender): Promise<Delivery> {
  if (email.html === null) {
    // Only a finished row has no body, and a finished row is never claimed.
    return recordFailure(email, 'EMAIL_BODY_MISSING', 0)
  }

  let result: SendResult
  try {
    result = await send({
      to: email.to_email,
      subject: email.subject,
      html: email.html,
      idempotencyKey: email.id,
    })
  } catch (err) {
    result = { success: false, error: err }
  }

  if (result.success) {
    const { data, error } = await supabase.rpc('complete_email_outbox', {
      p_id: email.id,
      p_worker: WORKER_ID,
      p_provider_id: result.id ?? null,
    })
    if (error) throw error
    return data === true ? 'sent' : 'lost'
  }
  return recordFailure(email, describe(result.error), retryDelaySeconds(email.attempts))
}

async function recordFailure(
  email: OutboxEmail,
  message: string,
  delaySeconds: number,
): Promise<Delivery> {
  const { data, error } = await supabase.rpc('fail_email_outbox', {
    p_id: email.id,
    p_worker: WORKER_ID,
    p_error: message,
    p_retry_delay_seconds: delaySeconds,
  })
  if (error) throw error
  if (data === 'pending') return 'retry'
  if (data === 'failed') return 'failed'
  return 'lost'
}

/**
 * One poll: retries that are due and emails whose sender died. Safe to run on
 * every instance at once — a row is claimed by one of them.
 */
export async function drainOutbox(
  send: EmailSender,
  limit = 10,
): Promise<Record<Delivery, number> | null> {
  const claimed = await claimEmails(limit)
  if (claimed === null) return null
  const counts: Record<Delivery, number> = { sent: 0, retry: 0, failed: 0, lost: 0 }
  for (const [i, email] of claimed.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, SEND_SPACING_MS))
    counts[await deliverClaimed(email, send)]++
  }
  return counts
}
