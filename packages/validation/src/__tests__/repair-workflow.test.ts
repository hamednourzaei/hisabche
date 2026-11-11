import { describe, expect, it } from 'vitest'
import {
  canConsumePartsOnRepair,
  repairDisplayStage,
  repairMoveRefusal,
  repairPartReservationInput,
  splitRepairInvoiceRevenue,
  summarizeRepairMetrics,
} from '../index'

describe('8.4 Repair Shop Workflow: Lifecycle, Approval, ATP Parts, Revenue Split & Metrics', () => {
  it('enforces legal status transitions, cancel note, and delivery invoice rule', () => {
    expect(repairMoveRefusal('received', { status: 'delivered', invoiceId: 'inv-1' })).toBe(
      'REPAIR_MOVE_NOT_ALLOWED',
    )
    expect(repairMoveRefusal('diagnosing', { status: 'cancelled' })).toBe(
      'REPAIR_CANCEL_NOTE_REQUIRED',
    )
    expect(repairMoveRefusal('diagnosing', { status: 'waiting_parts', invoiceId: 'inv-1' })).toBe(
      'REPAIR_INVOICE_ONLY_ON_DELIVERY',
    )
    expect(
      repairMoveRefusal('ready', {
        status: 'delivered',
        invoiceId: '11111111-1111-4111-8111-111111111111',
      }),
    ).toBeNull()
  })

  it('requires diagnosis + customer approval before reserving/consuming spare parts', () => {
    expect(canConsumePartsOnRepair({ status: 'received', customerApproved: false })).toEqual({
      allowed: false,
      reason: 'REPAIR_APPROVAL_REQUIRED',
    })
    expect(canConsumePartsOnRepair({ status: 'diagnosing', customerApproved: false })).toEqual({
      allowed: false,
      reason: 'REPAIR_APPROVAL_REQUIRED',
    })
    expect(canConsumePartsOnRepair({ status: 'repairing', customerApproved: true })).toEqual({
      allowed: true,
    })
    expect(canConsumePartsOnRepair({ status: 'delivered', customerApproved: true })).toEqual({
      allowed: false,
      reason: 'REPAIR_TICKET_CLOSED',
    })

    const hold = repairPartReservationInput({
      ticketId: 't-1',
      warehouseId: 'wh-1',
      productId: 'part-screen',
      quantity: 1,
      idempotencyKey: 'repair-part-hold-1',
    })
    expect(hold.referenceType).toBe('repair_ticket')
    expect(hold.referenceId).toBe('t-1')
  })

  it('maps display stages, separates parts vs labor revenue, and reports mean turnaround null when unclosed', () => {
    expect(repairDisplayStage('diagnosing', { customerApproved: false })).toBe(
      'awaiting_customer_approval',
    )
    expect(repairDisplayStage('repairing', { testing: true })).toBe('testing')

    const split = splitRepairInvoiceRevenue([
      { offeringType: 'goods', lineTotalMinor: 4500 },
      { offeringType: 'service', lineTotalMinor: 1500 },
    ])
    expect(split).toEqual({
      partsRevenueMinor: 4500,
      laborRevenueMinor: 1500,
      totalRevenueMinor: 6000,
    })

    const openOnly = summarizeRepairMetrics([
      {
        status: 'waiting_parts',
        underWarranty: true,
        createdAt: '2026-11-11T08:00:00Z',
        closedAt: null,
      },
    ])
    expect(openOnly.openTickets).toBe(1)
    expect(openOnly.waitingPartsTickets).toBe(1)
    expect(openOnly.meanRepairHours).toBeNull()

    const withDelivered = summarizeRepairMetrics([
      {
        status: 'delivered',
        underWarranty: false,
        createdAt: '2026-11-11T08:00:00Z',
        closedAt: '2026-11-11T12:30:00Z',
      },
    ])
    expect(withDelivered.meanRepairHours).toBe(4.5)
  })
})
