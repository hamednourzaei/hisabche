import { describe, expect, it, vi } from 'vitest'

vi.mock('../services/email-outbox', () => ({
  enqueueEmail: vi.fn(async () => ({ id: 'mail-1' })),
}))

describe('B.2.19 Scheduled email reports', () => {
  it('builds deterministic slot keys and dispatches once per recipient', async () => {
    const { ScheduledReportsService } =
      await import('../services/reporting/scheduled-reports.service')
    expect(ScheduledReportsService.slotKey('sched-1', '2026-10-26')).toBe(
      'scheduled-report:sched-1:2026-10-26',
    )
    const svc = new ScheduledReportsService()
    const res = await svc.triggerDelivery(
      'ws-1',
      {
        id: 'sched-1',
        workspaceId: 'ws-1',
        savedViewId: 'view-1',
        reportName: 'Weekly Sales',
        cadence: 'weekly',
        recipients: ['owner@example.com', 'cfo@example.com'],
        isActive: true,
      },
      '2026-10-26',
      '<p>Report</p>',
    )
    expect(res.sentCount).toBe(2)
    expect(res.idempotencyKey).toBe('scheduled-report:sched-1:2026-10-26')
  })
})
