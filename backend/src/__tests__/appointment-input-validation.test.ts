import { describe, expect, it } from 'vitest'
import { CrmAppointmentInputSchema } from '@hisabche/validation'

describe('CRM Appointment Input Validation (Wave 1)', () => {
  const validPayload = {
    customerId: 'a0000000-0000-0000-0000-000000000001',
    staffEmployeeId: 'b0000000-0000-0000-0000-000000000002',
    serviceProductId: 'c0000000-0000-0000-0000-000000000003',
    startTime: '2026-11-17T10:00:00Z',
    endTime: '2026-11-17T11:00:00Z',
    notes: 'Regular checkup',
  }

  it('accepts a valid appointment payload', () => {
    const result = CrmAppointmentInputSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.customerId).toBe(validPayload.customerId)
      expect(result.data.notes).toBe('Regular checkup')
    }
  })

  it('rejects invalid uuid', () => {
    const invalid = { ...validPayload, customerId: 'not-a-uuid' }
    const result = CrmAppointmentInputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Invalid customer ID')
    }
  })

  it('rejects end time earlier than start time', () => {
    const invalid = {
      ...validPayload,
      startTime: '2026-11-17T11:00:00Z',
      endTime: '2026-11-17T10:00:00Z',
    }
    const result = CrmAppointmentInputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        'End time must be strictly after start time',
      )
    }
  })

  it('rejects invalid date strings', () => {
    const invalid = { ...validPayload, startTime: 'not-a-date' }
    const result = CrmAppointmentInputSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
