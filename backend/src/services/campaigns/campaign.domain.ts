// ============================================
// backend/src/services/campaigns/campaign.domain.ts
//
// Customer campaigns (#112) and the NPS question (#106) — the parts that are
// arithmetic and text, with no database and no provider.
//
// ⚠️ WHO IS WRITTEN TO IS DECIDED HERE, FROM FACTS THE BUSINESS ALREADY HAS:
// the customer list and the sale invoices. There is no «segment» table and no
// second definition of «overdue» — it is an invoice with a balance past its
// due date, as everywhere else.
//
// ⚠️ EVERY CUSTOMER IN THE SEGMENT GETS A LINE: sent, or skipped WITH the
// reason (no address, an address that is not one, asked not to be written to).
// A customer silently left out is a customer the shop believes it wrote to.
//
// ⚠️ WHAT A PERSON TYPED IS TEXT, NEVER MARKUP. The body and the customer's
// name are escaped before they go into the email.
// ============================================

export type CampaignKind = 'message' | 'nps'
export type CampaignSegment = 'all' | 'overdue' | 'recent_buyers' | 'inactive'
export type CampaignLanguage = 'fa' | 'af' | 'en'
export type SkipReason = 'NO_EMAIL' | 'OPTED_OUT' | 'INVALID_EMAIL'

export const CAMPAIGN_SEGMENTS: readonly CampaignSegment[] = [
  'all',
  'overdue',
  'recent_buyers',
  'inactive',
]
/** Segments that need a number of days. */
export const SEGMENTS_WITH_DAYS: readonly CampaignSegment[] = ['recent_buyers', 'inactive']

/**
 * One launch writes to at most this many customers. A larger segment is
 * REFUSED with its size — never cut down to the first N, which would write to
 * an arbitrary part of the list and report the campaign as sent.
 */
export const MAX_CAMPAIGN_RECIPIENTS = 2000

/** How long an NPS link can still be answered after the campaign was sent. */
export const NPS_ANSWER_WINDOW_DAYS = 60

export interface AudienceCustomer {
  id: string
  name: string
  email: string | null
}

/** A sale invoice, as far as choosing an audience needs it. */
export interface AudienceInvoice {
  customerId: string | null
  invoiceDate: string
  dueDate: string
  /** Major units; only its sign is used. */
  outstanding: number
}

const addDays = (isoDay: string, days: number): string => {
  const [year, month, day] = isoDay.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * The customers a segment names, on `asOf`.
 *
 *   all            every customer
 *   overdue        owes on a sale invoice whose due date has passed
 *   recent_buyers  bought within the last `days`
 *   inactive       HAS bought, and not within the last `days` — a customer who
 *                  never bought is not «inactive», there is nothing to return to
 */
export function customersInSegment(
  customers: readonly AudienceCustomer[],
  invoices: readonly AudienceInvoice[],
  segment: CampaignSegment,
  days: number | null,
  asOf: string,
): AudienceCustomer[] {
  if (segment === 'all') return [...customers]

  if (segment === 'overdue') {
    const owing = new Set(
      invoices
        .filter(
          (invoice) =>
            invoice.customerId &&
            invoice.outstanding > 0 &&
            invoice.dueDate !== '' &&
            invoice.dueDate < asOf,
        )
        .map((invoice) => invoice.customerId as string),
    )
    return customers.filter((customer) => owing.has(customer.id))
  }

  const lastPurchase = new Map<string, string>()
  for (const invoice of invoices) {
    if (!invoice.customerId || invoice.invoiceDate === '') continue
    const seen = lastPurchase.get(invoice.customerId)
    if (!seen || invoice.invoiceDate > seen)
      lastPurchase.set(invoice.customerId, invoice.invoiceDate)
  }
  const cutoff = addDays(asOf, -(days ?? 0))
  return customers.filter((customer) => {
    const last = lastPurchase.get(customer.id)
    if (!last) return false
    return segment === 'recent_buyers' ? last >= cutoff : last < cutoff
  })
}

/** A single address with something on both sides of one «@» and a dot after it. */
export function isSendableEmail(value: string | null | undefined): boolean {
  if (!value) return false
  const email = value.trim()
  return email.length <= 254 && /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/.test(email)
}

export interface AudienceLine {
  customerId: string
  name: string
  email: string | null
  skipReason: SkipReason | null
}

/** Every customer of the segment, each either sendable or skipped with a reason. */
export function resolveAudience(
  segmentCustomers: readonly AudienceCustomer[],
  optedOut: ReadonlySet<string>,
): AudienceLine[] {
  return segmentCustomers.map((customer) => {
    const email = customer.email?.trim() || null
    const skipReason: SkipReason | null = optedOut.has(customer.id)
      ? 'OPTED_OUT'
      : !email
        ? 'NO_EMAIL'
        : !isSendableEmail(email)
          ? 'INVALID_EMAIL'
          : null
    return { customerId: customer.id, name: customer.name, email, skipReason }
  })
}

export function summariseAudience(lines: readonly AudienceLine[]) {
  const count = (reason: SkipReason) => lines.filter((line) => line.skipReason === reason).length
  return {
    total: lines.length,
    sendable: lines.filter((line) => line.skipReason === null).length,
    noEmail: count('NO_EMAIL'),
    invalidEmail: count('INVALID_EMAIL'),
    optedOut: count('OPTED_OUT'),
  }
}

// ─── The email ───────────────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** The fixed sentences of the email, per language. Not business content. */
const WORDS: Record<
  CampaignLanguage,
  { question: string; low: string; high: string; unsubscribe: string }
> = {
  fa: {
    question: 'چقدر احتمال دارد ما را به دیگران پیشنهاد کنید؟',
    low: 'اصلاً',
    high: 'حتماً',
    unsubscribe: 'دیگر این پیام‌ها را نمی‌خواهم',
  },
  af: {
    question: 'چقدر احتمال دارد ما را به دیگران پیشنهاد کنید؟',
    low: 'هرگز',
    high: 'حتماً',
    unsubscribe: 'دیگر این پیام‌ها را نمی‌خواهم',
  },
  en: {
    question: 'How likely are you to recommend us to others?',
    low: 'Not at all',
    high: 'Certainly',
    unsubscribe: 'I do not want these messages any more',
  },
}

export interface RenderInput {
  kind: CampaignKind
  language: CampaignLanguage
  body: string
  customerName: string
  businessName: string
  /** The recipient's page: `<site>/<lang>/feedback/<token>`. */
  feedbackUrl: string
}

/**
 * The HTML of one recipient's email.
 *
 * `{name}` in the body becomes the customer's name. An NPS campaign adds the
 * eleven score links; each opens the recipient's page with that score
 * PRE-SELECTED — the page asks for a press to submit, so a mail scanner that
 * follows links records nothing.
 */
export function renderCampaignEmail(input: RenderInput): string {
  const words = WORDS[input.language]
  const direction = input.language === 'en' ? 'ltr' : 'rtl'
  const body = escapeHtml(input.body)
    .split('{name}')
    .join(escapeHtml(input.customerName))
    .replace(/\r?\n/g, '<br>')

  const scores =
    input.kind === 'nps'
      ? `<p style="margin:24px 0 8px;font-weight:bold">${escapeHtml(words.question)}</p>` +
        `<p dir="ltr" style="margin:0">` +
        Array.from(
          { length: 11 },
          (_, score) =>
            `<a href="${escapeHtml(`${input.feedbackUrl}?score=${score}`)}" style="display:inline-block;min-width:28px;margin:2px;padding:8px 4px;border:1px solid #888;border-radius:6px;text-align:center;text-decoration:none;color:inherit">${score}</a>`,
        ).join('') +
        `</p><p style="margin:4px 0 0;font-size:12px;color:#666">0 = ${escapeHtml(words.low)} · 10 = ${escapeHtml(words.high)}</p>`
      : ''

  return (
    `<div dir="${direction}" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#222">` +
    `<p style="margin:0 0 16px">${body}</p>` +
    scores +
    `<p style="margin:24px 0 0;font-size:13px;color:#444">${escapeHtml(input.businessName)}</p>` +
    `<p style="margin:16px 0 0;font-size:12px"><a href="${escapeHtml(`${input.feedbackUrl}?unsubscribe=1`)}" style="color:#666">${escapeHtml(words.unsubscribe)}</a></p>` +
    `</div>`
  )
}

/** Whether an NPS link sent on `sentAt` may still be answered on `asOf`. */
export function canStillAnswer(sentAt: string | null, asOf: string): boolean {
  if (!sentAt) return false
  return asOf <= addDays(sentAt.slice(0, 10), NPS_ANSWER_WINDOW_DAYS)
}
