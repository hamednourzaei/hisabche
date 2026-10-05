// ============================================
// packages/validation/src/schemas/automation.schema.ts
//
// The request contracts of standing arrangements (capability #63, recurring
// invoice). The rules of WHEN one runs live in the backend's
// `automation/schedule.domain.ts`; this file is only what a client may send.
// ============================================

import { z } from 'zod'

import { SCHEDULE_CALENDARS } from './calendar-day'

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date')

/**
 * When an arrangement runs.
 *
 *   monthly   a named day of the month, IN A NAMED CALENDAR — a shop that
 *             keeps solar Hijri months means the 1st of Mehr, not the 1st of
 *             October. The 31st runs on the last day of a shorter month
 *             rather than skipping it. `calendar` defaults to Gregorian only
 *             so rows saved before it existed keep their meaning.
 *   interval  every N days from a start date
 *   once      on one date
 */
export const automationCadenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('monthly'),
    dayOfMonth: z.number().int().min(1).max(31),
    calendar: z.enum(SCHEDULE_CALENDARS).default('gregory'),
    from: isoDay,
    /**
     * Run at this minute of the day (0–1439) in `timeZone`, not at the daily
     * pass. Absent = the daily pass, which is what every earlier row means.
     * The runner looks every five minutes, so that is the precision.
     */
    atMinute: z.number().int().min(0).max(1439).optional(),
    timeZone: z.string().min(1).max(64).optional(),
  }),
  z.object({
    kind: z.literal('interval'),
    everyDays: z.number().int().min(1).max(366),
    from: isoDay,
  }),
  z.object({ kind: z.literal('once'), on: isoDay }),
])

export type AutomationCadence = z.infer<typeof automationCadenceSchema>

export const AUTOMATION_FAILURE_POLICIES = ['stop', 'keep', 'ignore'] as const

/**
 * A recurring invoice.
 *
 * `invoice` is the body `POST /api/invoices` takes, WITHOUT its dates and its
 * payments: each issue is dated the day it is for, and is issued unpaid — a
 * payment is something that happens, not something a template can promise. The
 * server validates it with the invoice's own schema, so a template the invoice
 * route would refuse cannot be saved.
 */
export const createRecurringInvoiceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cadence: automationCadenceSchema,
  /** Days from the issue date to the due date. Absent = no due date. */
  dueInDays: z.number().int().min(0).max(365).optional(),
  invoice: z.record(z.unknown()),
  onFailure: z.enum(AUTOMATION_FAILURE_POLICIES).default('stop'),
  maxAttempts: z.number().int().min(1).max(20).default(3),
})

export type CreateRecurringInvoice = z.input<typeof createRecurringInvoiceSchema>

/** Rename, re-time, pause or resume. The template itself is not edited in place. */
export const updateAutomationSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    cadence: automationCadenceSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'automation.errors.empty' })

export type UpdateAutomation = z.infer<typeof updateAutomationSchema>
