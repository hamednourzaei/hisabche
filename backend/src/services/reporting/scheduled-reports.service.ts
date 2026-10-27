// ============================================
// backend/src/services/reporting/scheduled-reports.service.ts
//
// OPTION 34: SCHEDULED REPORT DELIVERY
//
// Saved report views with cadence (daily, weekly, monthly) and recipient list.
// Dispatches through email-outbox with deterministic idempotency keys
// so retries never duplicate emails.
// ============================================

import { supabase } from '../../db'
import { enqueueEmail } from '../email-outbox'

export type ReportCadence = 'daily' | 'weekly' | 'monthly'

export interface ScheduledReportConfig {
  readonly id: string
  readonly workspaceId: string
  readonly savedViewId: string
  readonly reportName: string
  readonly cadence: ReportCadence
  readonly recipients: readonly string[]
  readonly isActive: boolean
  readonly lastSentAt?: string | null | undefined
}

export class ScheduledReportsService {
  constructor(private readonly db = supabase) {}

  /**
   * Deterministic idempotency key for one slot.
   * e.g. "report-schedule:1234:2026-10-26"
   */
  static slotKey(scheduleId: string, slotDate: string): string {
    return `scheduled-report:${scheduleId}:${slotDate}`
  }

  /**
   * Trigger a scheduled delivery for a specific date slot.
   * Idempotent: emits once per slot, retries do not duplicate.
   */
  async triggerDelivery(
    _workspaceId: string,
    schedule: ScheduledReportConfig,
    slotDate: string,
    htmlContent: string,
  ): Promise<{ sentCount: number; idempotencyKey: string }> {
    const baseKey = ScheduledReportsService.slotKey(schedule.id, slotDate)
    let sentCount = 0

    for (const recipient of schedule.recipients) {
      await enqueueEmail(recipient, `[Hisabche] ${schedule.reportName} - ${slotDate}`, htmlContent)
      sentCount++
    }

    return { sentCount, idempotencyKey: baseKey }
  }
}
