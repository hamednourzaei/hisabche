// ============================================
// backend/src/services/campaigns/campaign.service.ts
//
// Customer campaigns (#112) and NPS (#106), sent by EMAIL through the outbox
// the product already has (email-outbox.ts → Resend).
//
// ⚠️ THERE IS NO SECOND WAY TO SEND. Launching writes outbox rows; the existing
// poller delivers them with its own retries. This service never calls the mail
// provider, and «sent» is whatever the outbox row says — never assumed.
//
// ⚠️ A CAMPAIGN IS NOT LAUNCHED WHEN EMAIL IS NOT CONFIGURED. Without the
// provider key every outbox row would fail five times and the campaign would
// read as «sent»; it is refused up front with the reason.
//
// ⚠️ LAUNCH IS ONE DATABASE FUNCTION (`campaign_launch`): recipients and their
// emails are written together or not at all, and a campaign launches once.
//
// The audience and the email text are the domain's (campaign.domain.ts); the
// score is the NPS engine's (`netPromoterScore`).
// ============================================

import { randomUUID } from 'node:crypto'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { netPromoterScore, type NpsResult } from '../customers/nps.domain'
import type { TenancyContext } from '../tenancy.service'
import {
  MAX_CAMPAIGN_RECIPIENTS,
  canStillAnswer,
  customersInSegment,
  renderCampaignEmail,
  resolveAudience,
  summariseAudience,
  type AudienceCustomer,
  type AudienceInvoice,
  type AudienceLine,
  type CampaignKind,
  type CampaignLanguage,
  type CampaignSegment,
} from './campaign.domain'

const MISSING_SCHEMA = new Set(['42703', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'])
const CAMPAIGN_COLUMNS =
  'id, name, kind, subject, body, language, segment, segment_days, status, created_at, sent_at'

/** Refusals `campaign_launch` raises by name. */
const LAUNCH_ERRORS = [
  'CAMPAIGN_NOT_FOUND',
  'CAMPAIGN_ALREADY_SENT',
  'CAMPAIGN_NO_RECIPIENTS',
] as const

export class CampaignsNotConfiguredError extends BaseError {
  constructor() {
    super('CAMPAIGNS_MIGRATION_PENDING', 503)
    this.name = 'CampaignsNotConfiguredError'
  }
}

export interface CampaignInput {
  name: string
  kind: CampaignKind
  subject: string
  body: string
  language: CampaignLanguage
  segment: CampaignSegment
  segmentDays: number | null
}

export interface Campaign extends CampaignInput {
  id: string
  status: 'draft' | 'sent' | 'cancelled'
  createdAt: string
  sentAt: string | null
}

export interface CampaignDelivery {
  /** Emails written to the outbox. */
  queued: number
  /** …of which the provider has accepted. */
  sent: number
  /** …still waiting or being retried. */
  pending: number
  /** …given up on after the outbox's retries. */
  failed: number
  /** …whose outbox row can no longer be found: state not known. */
  unknown: number
  skipped: { noEmail: number; invalidEmail: number; optedOut: number }
}

export interface CampaignDetail {
  campaign: Campaign
  delivery: CampaignDelivery
  /** Null for a plain message, and for an NPS campaign not sent yet. */
  nps:
    (NpsResult & { comments: Array<{ score: number; comment: string; answeredAt: string }> }) | null
}

interface CampaignRow {
  id: string
  name: string
  kind: CampaignKind
  subject: string
  body: string
  language: CampaignLanguage
  segment: CampaignSegment
  segment_days: number | null
  status: Campaign['status']
  created_at: string
  sent_at: string | null
}

const toCampaign = (row: CampaignRow): Campaign => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  subject: row.subject,
  body: row.body,
  language: row.language,
  segment: row.segment,
  segmentDays: row.segment_days,
  status: row.status,
  createdAt: row.created_at,
  sentAt: row.sent_at,
})

const today = () => new Date().toISOString().slice(0, 10)
const day = (value: unknown) => String(value ?? '').slice(0, 10)

function fail(error: { code?: string; message: string }, what: string): never {
  if (MISSING_SCHEMA.has(error.code ?? '')) throw new CampaignsNotConfiguredError()
  throw new DatabaseError(what, error)
}

/** Where a recipient's page lives. The site's own address, never one from a request. */
const siteUrl = () => (process.env.FRONTEND_URL || 'https://hisabche.com').replace(/\/+$/, '')

export class CampaignService {
  /**
   * Whether an email can actually leave. Only the PRESENCE of the provider key
   * is read; its value is never looked at here.
   */
  channelStatus(): { email: { configured: boolean } } {
    return { email: { configured: Boolean(process.env.RESEND_API_KEY) } }
  }

  async list(ctx: TenancyContext): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('customer_campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(200)
    if (error) fail(error, 'Failed to read campaigns')
    return ((data ?? []) as CampaignRow[]).map(toCampaign)
  }

  async create(ctx: TenancyContext, input: CampaignInput): Promise<Campaign> {
    const { data, error } = await supabase
      .from('customer_campaigns')
      .insert({
        workspace_id: ctx.workspaceId,
        created_by: ctx.userId,
        name: input.name.trim(),
        kind: input.kind,
        subject: input.subject.trim(),
        body: input.body.trim(),
        language: input.language,
        segment: input.segment,
        segment_days: input.segmentDays,
      })
      .select(CAMPAIGN_COLUMNS)
      .single()
    if (error) fail(error, 'Failed to save the campaign')
    return toCampaign(data as CampaignRow)
  }

  private async find(ctx: TenancyContext, id: string): Promise<Campaign> {
    const { data, error } = await supabase
      .from('customer_campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the campaign')
    if (!data) throw new NotFoundError('Campaign')
    return toCampaign(data as CampaignRow)
  }

  /** A draft nobody will send. A sent campaign is history and stays. */
  async cancel(ctx: TenancyContext, id: string): Promise<Campaign> {
    const { data, error } = await supabase
      .from('customer_campaigns')
      .update({ status: 'cancelled' })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .eq('status', 'draft')
      .select(CAMPAIGN_COLUMNS)
      .maybeSingle()
    if (error) fail(error, 'Failed to cancel the campaign')
    if (!data) {
      await this.find(ctx, id)
      throw new ConflictError('CAMPAIGN_ALREADY_SENT')
    }
    return toCampaign(data as CampaignRow)
  }

  /** Who the campaign's segment names today, each sendable or skipped with a reason. */
  private async audience(ctx: TenancyContext, campaign: Campaign): Promise<AudienceLine[]> {
    const customers = await selectAllPages<
      { id: string; full_name: string | null; email: string | null },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('customers')
        .select('id, full_name, email')
        .eq('workspace_id', ctx.workspaceId)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (customers.error) throw new DatabaseError('Failed to read customers', customers.error)

    let invoices: AudienceInvoice[] = []
    if (campaign.segment !== 'all') {
      const rows = await selectAllPages<
        {
          customer_id: string | null
          invoice_date: string | null
          due_date: string | null
          outstanding: number | string | null
        },
        { message: string; code?: string }
      >((from, to) =>
        supabase
          .from('invoice_outstanding')
          .select('invoice_id, customer_id, invoice_date, due_date, outstanding')
          .eq('workspace_id', ctx.workspaceId)
          .eq('type', 'sale')
          .order('invoice_id', { ascending: true })
          .range(from, to),
      )
      if (rows.error)
        throw new DatabaseError('Failed to read invoices for the audience', rows.error)
      invoices = (rows.data ?? []).map((row) => ({
        customerId: row.customer_id,
        invoiceDate: day(row.invoice_date),
        dueDate: day(row.due_date),
        outstanding: Number(row.outstanding) || 0,
      }))
    }

    const optouts = await selectAllPages<
      { customer_id: string },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('customer_contact_optouts')
        .select('customer_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('channel', 'email')
        .order('customer_id', { ascending: true })
        .range(from, to),
    )
    if (optouts.error) fail(optouts.error, 'Failed to read opt-outs')

    const list: AudienceCustomer[] = (customers.data ?? []).map((row) => ({
      id: row.id,
      name: row.full_name ?? '',
      email: row.email,
    }))
    return resolveAudience(
      customersInSegment(list, invoices, campaign.segment, campaign.segmentDays, today()),
      new Set((optouts.data ?? []).map((row) => row.customer_id)),
    )
  }

  /** Who WOULD be written to. Writes nothing. */
  async preview(ctx: TenancyContext, id: string) {
    const campaign = await this.find(ctx, id)
    const summary = summariseAudience(await this.audience(ctx, campaign))
    return {
      ...summary,
      limit: MAX_CAMPAIGN_RECIPIENTS,
      tooLarge: summary.total > MAX_CAMPAIGN_RECIPIENTS,
      channel: this.channelStatus(),
    }
  }

  async launch(ctx: TenancyContext, id: string): Promise<{ queued: number; skipped: number }> {
    const campaign = await this.find(ctx, id)
    if (campaign.status !== 'draft') throw new ConflictError('CAMPAIGN_ALREADY_SENT')
    if (!this.channelStatus().email.configured)
      throw new ValidationError('CAMPAIGN_EMAIL_NOT_CONFIGURED')

    const lines = await this.audience(ctx, campaign)
    if (lines.length === 0) throw new ValidationError('CAMPAIGN_NO_RECIPIENTS')
    // Refused, not cut down: writing to the first N of a list is writing to an
    // arbitrary part of it.
    if (lines.length > MAX_CAMPAIGN_RECIPIENTS)
      throw new ValidationError('CAMPAIGN_AUDIENCE_TOO_LARGE')
    if (!lines.some((line) => line.skipReason === null))
      throw new ValidationError('CAMPAIGN_NOBODY_REACHABLE')

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', ctx.workspaceId)
      .maybeSingle()
    if (workspaceError) throw new DatabaseError('Failed to read the workspace', workspaceError)
    const businessName = String((workspace as { name?: string } | null)?.name ?? '')

    const payload = lines.map((line) => {
      const token = randomUUID()
      if (line.skipReason) {
        return {
          customer_id: line.customerId,
          email: line.email ?? '',
          token,
          skip_reason: line.skipReason,
        }
      }
      return {
        customer_id: line.customerId,
        email: line.email,
        token,
        html: renderCampaignEmail({
          kind: campaign.kind,
          language: campaign.language,
          body: campaign.body,
          customerName: line.name,
          businessName,
          feedbackUrl: `${siteUrl()}/${campaign.language}/feedback/${token}`,
        }),
      }
    })

    const { data, error } = await supabase.rpc('campaign_launch', {
      p_workspace_id: ctx.workspaceId,
      p_user_id: ctx.userId,
      p_campaign_id: id,
      p_lines: payload,
    })
    if (error) {
      if (MISSING_SCHEMA.has(error.code ?? '')) throw new CampaignsNotConfiguredError()
      const code = LAUNCH_ERRORS.find((known) => (error.message ?? '').includes(known))
      if (code === 'CAMPAIGN_NOT_FOUND') throw new NotFoundError('Campaign')
      if (code === 'CAMPAIGN_ALREADY_SENT') throw new ConflictError(code)
      if (code) throw new ValidationError(code)
      throw new DatabaseError('Failed to launch the campaign', error)
    }
    const result = (data ?? {}) as { queued?: number; skipped?: number }
    return { queued: Number(result.queued) || 0, skipped: Number(result.skipped) || 0 }
  }

  /** What happened to a campaign: delivery from the outbox, and the NPS score. */
  async detail(ctx: TenancyContext, id: string): Promise<CampaignDetail> {
    const campaign = await this.find(ctx, id)
    const recipients = await selectAllPages<
      {
        outbox_id: string | null
        skip_reason: string | null
        nps_score: number | null
        nps_comment: string | null
        responded_at: string | null
        customer_id: string
      },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('campaign_recipients')
        .select('id, customer_id, outbox_id, skip_reason, nps_score, nps_comment, responded_at')
        .eq('workspace_id', ctx.workspaceId)
        .eq('campaign_id', id)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (recipients.error) fail(recipients.error, 'Failed to read recipients')
    const rows = recipients.data ?? []

    const outboxIds = rows.map((row) => row.outbox_id).filter((value): value is string => !!value)
    const status = new Map<string, string>()
    const CHUNK = 200
    for (let index = 0; index < outboxIds.length; index += CHUNK) {
      const { data, error } = await supabase
        .from('email_outbox')
        .select('id, status')
        .in('id', outboxIds.slice(index, index + CHUNK))
      if (error) throw new DatabaseError('Failed to read delivery state', error)
      for (const row of (data ?? []) as Array<{ id: string; status: string }>)
        status.set(row.id, row.status)
    }

    const delivery: CampaignDelivery = {
      queued: outboxIds.length,
      sent: 0,
      pending: 0,
      failed: 0,
      unknown: 0,
      skipped: { noEmail: 0, invalidEmail: 0, optedOut: 0 },
    }
    for (const row of rows) {
      if (row.skip_reason === 'NO_EMAIL') delivery.skipped.noEmail += 1
      else if (row.skip_reason === 'INVALID_EMAIL') delivery.skipped.invalidEmail += 1
      else if (row.skip_reason === 'OPTED_OUT') delivery.skipped.optedOut += 1
      if (!row.outbox_id) continue
      const state = status.get(row.outbox_id)
      if (state === 'sent') delivery.sent += 1
      else if (state === 'failed') delivery.failed += 1
      else if (state === 'pending' || state === 'sending') delivery.pending += 1
      // An outbox row that is gone: said as «unknown», never counted as sent.
      else delivery.unknown += 1
    }

    if (campaign.kind !== 'nps' || campaign.status !== 'sent')
      return { campaign, delivery, nps: null }

    const answered = rows.filter((row) => row.nps_score !== null && row.responded_at !== null)
    const result = netPromoterScore(
      answered.map((row) => ({
        customerId: row.customer_id,
        score: row.nps_score as number,
        answeredOn: day(row.responded_at),
      })),
      // Who was ASKED: the people an email was written for, not the whole segment.
      delivery.queued,
    )
    return {
      campaign,
      delivery,
      nps: {
        ...result,
        comments: answered
          .filter((row) => (row.nps_comment ?? '').trim() !== '')
          .map((row) => ({
            score: row.nps_score as number,
            comment: row.nps_comment as string,
            answeredAt: row.responded_at as string,
          }))
          .sort((a, b) => b.answeredAt.localeCompare(a.answeredAt))
          .slice(0, 200),
      },
    }
  }

  // ─── The customer's side (no account; the token is the credential) ─────────

  private async byToken(token: string) {
    const { data, error } = await supabase
      .from('campaign_recipients')
      .select('id, workspace_id, campaign_id, customer_id, outbox_id, nps_score, responded_at')
      .eq('token', token)
      .maybeSingle()
    if (error) fail(error, 'Failed to read the link')
    // A skipped recipient was never sent a link: its token opens nothing.
    if (!data || !(data as { outbox_id: string | null }).outbox_id) throw new NotFoundError('Link')
    const recipient = data as {
      id: string
      workspace_id: string
      campaign_id: string
      customer_id: string
      outbox_id: string
      nps_score: number | null
      responded_at: string | null
    }
    const { data: campaign, error: campaignError } = await supabase
      .from('customer_campaigns')
      .select('kind, language, sent_at')
      .eq('workspace_id', recipient.workspace_id)
      .eq('id', recipient.campaign_id)
      .maybeSingle()
    if (campaignError) fail(campaignError, 'Failed to read the campaign')
    if (!campaign) throw new NotFoundError('Link')
    return {
      recipient,
      campaign: campaign as {
        kind: CampaignKind
        language: CampaignLanguage
        sent_at: string | null
      },
    }
  }

  /** What a recipient's page shows. Names the business and nothing about anyone else. */
  async feedbackView(token: string) {
    const { recipient, campaign } = await this.byToken(token)
    const [{ data: workspace }, { data: optout }] = await Promise.all([
      supabase.from('workspaces').select('name').eq('id', recipient.workspace_id).maybeSingle(),
      supabase
        .from('customer_contact_optouts')
        .select('customer_id')
        .eq('workspace_id', recipient.workspace_id)
        .eq('customer_id', recipient.customer_id)
        .eq('channel', 'email')
        .maybeSingle(),
    ])
    return {
      businessName: String((workspace as { name?: string } | null)?.name ?? ''),
      asksForScore: campaign.kind === 'nps',
      answered: recipient.nps_score !== null,
      canAnswer:
        campaign.kind === 'nps' &&
        recipient.nps_score === null &&
        canStillAnswer(campaign.sent_at, today()),
      unsubscribed: !!optout,
    }
  }

  /** Record a score. Once: a second answer changes nothing and says so. */
  async answer(
    token: string,
    input: { score: number; comment: string | null },
  ): Promise<{ recorded: boolean }> {
    const { recipient, campaign } = await this.byToken(token)
    if (campaign.kind !== 'nps') throw new ValidationError('NPS_NOT_ASKED')
    if (recipient.nps_score !== null) return { recorded: false }
    if (!canStillAnswer(campaign.sent_at, today())) throw new ValidationError('NPS_LINK_EXPIRED')

    const { data, error } = await supabase
      .from('campaign_recipients')
      .update({
        nps_score: input.score,
        nps_comment: input.comment?.trim() ? input.comment.trim().slice(0, 1000) : null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', recipient.id)
      // The claim: only a row that is STILL unanswered is written.
      .is('nps_score', null)
      .select('id')
      .maybeSingle()
    if (error) fail(error, 'Failed to record the answer')
    return { recorded: !!data }
  }

  /** «Do not write to me again.» Idempotent. */
  async unsubscribe(token: string): Promise<{ unsubscribed: true }> {
    const { recipient } = await this.byToken(token)
    const { error } = await supabase
      .from('customer_contact_optouts')
      .upsert(
        {
          workspace_id: recipient.workspace_id,
          customer_id: recipient.customer_id,
          channel: 'email',
        },
        { onConflict: 'workspace_id,customer_id,channel', ignoreDuplicates: true },
      )
    if (error) fail(error, 'Failed to record the opt-out')
    return { unsubscribed: true }
  }
}

export const campaignService = new CampaignService()
