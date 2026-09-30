// ============================================
// Capabilities #51, #53, #66 — collections and payment scheduling.
// Engine N2.
//
// ⚠️ THIS DOES NOT DECIDE WHO OWES WHAT. `payments.domain` does.
//
// `ageInvoices` already buckets every open invoice by how late it is, and
// `outstandingOf` already derives the figure from allocations. Neither is
// touched here. What was missing is everything AFTER the bucketing: who gets
// chased, when, how often, and what happens when they do not answer.
//
// The reason that is a separate module and not a route is that the SEQUENCE is
// the content. A reminder that fires twice, or a chase that starts before the
// grace period the shop configured, is worse than no chase at all — it turns a
// customer relationship into a collections dispute.
//
// ⚠️ A REMINDER IS NOT A PAYMENT, AND NEVER TOUCHES THE LEDGER.
//
// Nothing in this file moves money or writes to the books. A reminder is a
// notification; the money still arrives through `PaymentsService.recordPayment`
// and still allocates through the path that already works. An engine that
// "helpfully" created the payment itself would be a second money path — the
// exact shape that produced the offline-invoice gap (M2) and BUG-005.
//
// ⚠️ CADENCE IS MONOTONIC, AND THAT IS WHAT MAKES IT DIGNIFIED.
//
// Once the sequence reaches its last step it STAYS there. A schedule that
// wrapped back to the first step would send a gentle note on month eight after
// escalating to a final demand on month three, which is both nonsense and a
// thing a customer would screenshot.
//
// ⚠️ A CUSTOMER WHO HAS PAID IS SILENT. No message is ever generated for a
// settled debt, even inside the grace period of a step that would otherwise have
// fired — and that check happens FIRST, before any step is consulted. The failure
// this prevents is a "your account is overdue" notice landing on someone who
// paid an hour ago.
// ============================================

import type { OpenInvoice } from '../payments/payments.domain'
import { openInvoices, outstandingOf } from '../payments/payments.domain'

/** Which channel a reminder goes out on. Notification delivery is not this module's job. */
export type ReminderChannel = 'notification' | 'email' | 'sms'

/** How insistent this step is. Ordered — the sequence only ever increases. */
export type ReminderTone = 'courtesy' | 'formal' | 'firm' | 'final'

export interface ReminderStep {
  /** Whole days after the due date. The schedule is keyed on this. */
  afterDays: number
  tone: ReminderTone
  channel: ReminderChannel
  /**
   * ⚠️ Whether to stop reminding once this step has passed without payment.
   *
   * Defaults to true in practice: a shop that says «we stop after the third
   * reminder» means it, and a collections engine that keeps writing after that
   * is the reason customers block a sender's number.
   */
  terminal: boolean
}

export interface ReminderSettings {
  steps: ReminderStep[]
  /** The smallest debt worth chasing. Below this, nobody is bothered. */
  minAmountMinor: number
  /** A debt at or below this is never chased, whatever the steps say. */
  writeOffMinor: number
  /**
   * ⚠️ MUST BE MONOTONIC WHEN VALIDATED — `validateSteps` refuses a sequence
   * whose tone goes backwards, because `ReminderTone` order is what the
   * sequencer compares and a downgrade would send a final demand as a courtesy.
   */
}

export const DEFAULT_REMINDER_STEPS: ReminderStep[] = [
  { afterDays: 3, tone: 'courtesy', channel: 'notification', terminal: false },
  { afterDays: 15, tone: 'formal', channel: 'email', terminal: false },
  { afterDays: 45, tone: 'firm', channel: 'email', terminal: false },
  { afterDays: 75, tone: 'final', channel: 'notification', terminal: true },
]

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  steps: DEFAULT_REMINDER_STEPS,
  minAmountMinor: 0,
  writeOffMinor: 0,
}

/** Whole days between two ISO days, ignoring the time of day. */
export function daysPastDue(dueDate: string, asOf: string): number {
  const start = Date.parse(`${dueDate.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000)
}

export type CollectionsRuleCode =
  'COLLECTIONS_STEPS_UNORDERED' | 'COLLECTIONS_TONE_DOWNGRADE' | 'COLLECTIONS_STEP_TOO_SOON'

/**
 * A schedule that would embarrass the shop sends it.
 *
 * ⚠️ This runs when a shop SAVES its settings, not when a reminder is sent. A
 * broken schedule discovered at send time has already emailed customers.
 */
export function validateSteps(steps: readonly ReminderStep[]): {
  code: CollectionsRuleCode
  detail: string
}[] {
  const problems: { code: CollectionsRuleCode; detail: string }[] = []
  const toneRank: Record<ReminderTone, number> = { courtesy: 0, formal: 1, firm: 2, final: 3 }

  let previousDays = -1
  let previousTone = -1

  for (const [index, step] of steps.entries()) {
    if (step.afterDays <= previousDays) {
      problems.push({
        code: 'COLLECTIONS_STEPS_UNORDERED',
        detail: `step ${index + 1} is at ${step.afterDays} days, not after the previous ${previousDays}`,
      })
    }
    previousDays = step.afterDays

    const rank = toneRank[step.tone]
    if (rank < previousTone) {
      // ⚠️ Sending a «final demand» as a «courtesy reminder» on day 75 is worse
      // than any schedule bug, so this is refused rather than clamped.
      problems.push({
        code: 'COLLECTIONS_TONE_DOWNGRADE',
        detail: `step ${index + 1} is "${step.tone}" after a stronger one`,
      })
    }
    previousTone = Math.max(previousTone, rank)

    // ⚠️ A same-day reminder is not a reminder. Someone invoiced today has not
    // had a chance to open the email.
    if (step.afterDays < 1) {
      problems.push({
        code: 'COLLECTIONS_STEP_TOO_SOON',
        detail: `step ${index + 1} fires on day ${step.afterDays}`,
      })
    }
  }

  return problems
}

/** One reminder a shop should send today. */
export interface CollectionsAction {
  invoiceId: string
  invoiceNumber: string
  customerId: string | null
  outstandingMinor: number
  daysLate: number
  step: ReminderStep
  /**
   * ⚠️ The message body is NOT written here. It is a template with numbers in
   * it, and a sentence written by this engine would be a sentence in one
   * language inside a product with three (§7 and the i18n rule). The caller
   * renders it from `step.tone`.
   */
  tone: ReminderTone
  channel: ReminderChannel
}

export type CollectionsVerdict =
  | { kind: 'remind'; actions: CollectionsAction[] }
  /** Nothing is late enough, or what is late is too small to chase. */
  | { kind: 'nothing_to_do'; reason: 'NOT_DUE' | 'BELOW_MINIMUM'; count: number }
  /**
   * The shop's own schedule is broken, so NOTHING is sent.
   *
   * ⚠️ This is its own verdict and not a `nothing_to_do`. A caller that sees
   * "nothing to do" closes the day's collections run; a caller that sees "your
   * schedule is invalid" goes and fixes it. Reporting a broken schedule as a
   * quiet day means the shop never finds out.
   */
  | { kind: 'invalid_schedule'; problems: { code: CollectionsRuleCode; detail: string }[] }
  /** The debt is under the write-off threshold. It belongs in bad debt, not chasing. */
  | { kind: 'written_off'; invoiceIds: string[] }

/** What the engine already knows about a chased debt. */
export interface ChaseState {
  invoiceId: string
  /** The highest step index already sent. Null = none sent yet. */
  lastStepIndex: number | null
}

/**
 * Who gets chased today.
 *
 * ⚠️ ORDER MATTERS AND IS ASSERTED. The three checks are, in sequence: is it
 * paid, is it past a step, is it worth chasing. Putting "is it worth chasing"
 * first would skip a large number of invoices by reporting a count that is
 * smaller for the wrong reason; putting "is it paid" last would remind someone
 * who already settled.
 */
export function collectionsFor(
  invoices: readonly OpenInvoice[],
  asOf: string,
  settings: ReminderSettings = DEFAULT_REMINDER_SETTINGS,
  chased: readonly ChaseState[] = [],
): CollectionsVerdict {
  const problems = validateSteps(settings.steps)
  if (problems.length > 0) {
    // ⚠️ A broken schedule sends NOTHING — and says so. It does not fall back to
    // the default, because a fallback would send reminders the shop did not
    // configure while looking like the ones they did.
    return { kind: 'invalid_schedule', problems }
  }

  const stateByInvoice = new Map(chased.map((c) => [c.invoiceId, c]))
  const actions: CollectionsAction[] = []
  const writtenOff: string[] = []
  let belowMinimum = 0

  // ⚠️ `OpenInvoice` carries no customer id — it is an aging shape, deliberately
  // minimal. The collections engine needs one, because a reminder that cannot be
  // addressed cannot be delivered, so it arrives as a separate lookup rather than
  // by widening the payments type (which would put a collections concern inside
  // the aging core).
  const customerByInvoice = new Map(
    invoices.map((i) => [i.invoiceId, (i as { customerId?: string | null }).customerId ?? null]),
  )

  for (const invoice of openInvoices([...invoices])) {
    // 1. Paid. `openInvoices` already filtered these, so anything here still owes
    //    money — the check exists because it is the one that must never move.
    const outstandingMinor = Math.round(outstandingOf(invoice) * 100)
    if (outstandingMinor <= 0) continue

    // 2. Written off. A debt the shop has decided to carry no longer belongs in
    //    a collections list — it belongs in the bad-debt report.
    if (settings.writeOffMinor > 0 && outstandingMinor <= settings.writeOffMinor) {
      writtenOff.push(invoice.invoiceId)
      continue
    }

    // 3. Past a step that has not been sent yet.
    const late = daysPastDue(invoice.dueDate || invoice.invoiceDate, asOf)
    const state = stateByInvoice.get(invoice.invoiceId)
    const nextIndex = (state?.lastStepIndex ?? -1) + 1

    const step = settings.steps[nextIndex]
    if (!step) continue // sequence exhausted, or the last one was terminal

    if (late < step.afterDays) continue // not due yet

    // 4. Worth chasing.
    if (settings.minAmountMinor > 0 && outstandingMinor < settings.minAmountMinor) {
      belowMinimum += 1
      continue
    }

    actions.push({
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      customerId: customerByInvoice.get(invoice.invoiceId) ?? null,
      outstandingMinor,
      daysLate: late,
      step,
      tone: step.tone,
      channel: step.channel,
    })
  }

  if (actions.length > 0) return { kind: 'remind', actions }
  if (writtenOff.length > 0) return { kind: 'written_off', invoiceIds: writtenOff }
  return {
    kind: 'nothing_to_do',
    reason: belowMinimum > 0 ? 'BELOW_MINIMUM' : 'NOT_DUE',
    count: belowMinimum,
  }
}

/**
 * The step index a given number of days late corresponds to.
 *
 * ⚠️ MONOTONIC BY CONSTRUCTION — it returns the LAST step at or before the
 * days, never the next one up. So a chase that was ignored for two months and
 * then re-evaluated resumes at the firm stage, not the courtesy one, and a
 * customer who missed a reminder is not scolded from the beginning.
 */
export function stepForDays(daysLate: number, steps: readonly ReminderStep[]): ReminderStep | null {
  let chosen: ReminderStep | null = null
  for (const step of steps) {
    if (step.afterDays <= daysLate) chosen = step
    else break
  }
  return chosen
}

/** Is the sequence finished — this debt will get no further reminders? */
export function isExhausted(daysLate: number, steps: readonly ReminderStep[]): boolean {
  const step = stepForDays(daysLate, steps)
  return step !== null && step.terminal
}

// ─── Payment scheduling (#66) ────────────────────────────────────────────────

export interface ScheduledPayment {
  id: string
  invoiceId: string
  onDate: string
  amountMinor: number
  /**
   * ⚠️ Whether this was actually sent. A schedule that fires on a date the shop
   * has moved is not a payment — it is a stale reminder, and reporting it as
   * settled is how a shop tells a customer they paid when they did not.
   */
  status: 'pending' | 'sent' | 'skipped' | 'paid'
}

export type ScheduleRuleCode = 'SCHEDULE_DATE_IN_PAST' | 'SCHEDULE_AMOUNT_INVALID'

/**
 * Build a payment plan for a debt.
 *
 * ⚠️ THE TOTAL IS NEVER EXCEEDED OR SHORT. The last payment absorbs the
 * remainder, which is the same rule `installment.domain#planSchedule` uses and
 * for the same reason: a schedule that does not foot is one the customer
 * disputes.
 */
export function planPayments(
  outstandingMinor: number,
  count: number,
  firstDate: string,
  asOf: string,
): { rule?: ScheduleRuleCode; payments?: { onDate: string; amountMinor: number }[] } {
  if (!Number.isSafeInteger(outstandingMinor) || outstandingMinor <= 0) {
    return { rule: 'SCHEDULE_AMOUNT_INVALID' }
  }
  if (!Number.isSafeInteger(count) || count < 1) {
    return { rule: 'SCHEDULE_AMOUNT_INVALID' }
  }
  if (firstDate.slice(0, 10) <= asOf.slice(0, 10)) {
    // ⚠️ A first payment dated in the past would be chased the same day it was
    // agreed, which is not a schedule — it is an error with a date on it.
    return { rule: 'SCHEDULE_DATE_IN_PAST' }
  }

  const base = Math.floor(outstandingMinor / count)
  const remainder = outstandingMinor - base * count

  return {
    payments: Array.from({ length: count }, (_, index) => ({
      onDate: addMonthsIso(firstDate, index),
      amountMinor: base + (index === count - 1 ? remainder : 0),
    })),
  }
}

function addMonthsIso(isoDay: string, months: number): string {
  const [year, month, day] = isoDay.slice(0, 10).split('-').map(Number)
  const target = new Date(Date.UTC(year!, month! - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day!, lastDay)).padStart(2, '0')}`
}
