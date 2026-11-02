// ============================================
// packages/validation/src/__tests__/service-delivery.domain.test.ts
//
// M4 — SERVICE DELIVERY & ATTENDANCE CORE
// Unit tests for Service Delivery domain model and rules.
// ============================================

import { describe, expect, it } from 'vitest'
import {
  calculateSessionDurationMinutes,
  isValidSessionStatusTransition,
  planServiceDelivery,
  planServiceDeliveryCancellation,
  verifyPractitionerAttendance,
  type ServiceDeliverySession,
} from '../schemas/universal-core/service-delivery.domain'
import type { PackageCreditEntry } from '../schemas/universal-core/package-credit-ledger.domain'
import type { AttendanceDay } from '../schemas/attendance-rules'

describe('M4: Service Delivery Domain Core', () => {
  const ws1 = 'ws-test-1'
  const cust1 = 'cust-1'
  const service1 = 'srv-haircut'
  const pkgProd1 = 'pkg-course-10'
  const practitioner1 = 'emp-doc-1'

  const baseSession: ServiceDeliverySession = {
    id: 'ses-101',
    workspaceId: ws1,
    customerId: cust1,
    serviceOfferingId: service1,
    practitionerId: practitioner1,
    branchId: 'br-main',
    sessionDate: '2026-11-01',
    startTime: '10:00',
    endTime: '11:30',
    durationMinutes: 90,
    status: 'scheduled',
    settlementMethod: 'package_credit',
    packageCreditId: null,
    invoiceId: null,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  }

  describe('1. Duration Calculation', () => {
    it('calculates duration in minutes accurately', () => {
      expect(calculateSessionDurationMinutes('09:00', '10:30')).toBe(90)
      expect(calculateSessionDurationMinutes('14:15', '15:45')).toBe(90)
      expect(calculateSessionDurationMinutes('08:00', '08:45')).toBe(45)
    })

    it('calculates overnight duration when endsNextDay is true', () => {
      // 23:00 to 01:30 = 60 + 90 = 150 minutes
      expect(calculateSessionDurationMinutes('23:00', '01:30', true)).toBe(150)
    })

    it('throws error when end is before start without endsNextDay', () => {
      expect(() => calculateSessionDurationMinutes('15:00', '14:00')).toThrow(
        'SESSION_END_BEFORE_START',
      )
    })

    it('throws error on invalid time format', () => {
      expect(() => calculateSessionDurationMinutes('invalid', '12:00')).toThrow(
        'INVALID_SESSION_TIME_FORMAT',
      )
    })
  })

  describe('2. Lifecycle Transitions', () => {
    it('allows valid transitions', () => {
      expect(isValidSessionStatusTransition('scheduled', 'in_progress')).toBe(true)
      expect(isValidSessionStatusTransition('scheduled', 'delivered')).toBe(true)
      expect(isValidSessionStatusTransition('scheduled', 'cancelled')).toBe(true)
      expect(isValidSessionStatusTransition('in_progress', 'delivered')).toBe(true)
      expect(isValidSessionStatusTransition('in_progress', 'no_show')).toBe(true)
      expect(isValidSessionStatusTransition('delivered', 'cancelled')).toBe(true)
    })

    it('disallows invalid transitions', () => {
      expect(isValidSessionStatusTransition('cancelled', 'delivered')).toBe(false)
      expect(isValidSessionStatusTransition('no_show', 'delivered')).toBe(false)
    })
  })

  describe('3. Practitioner Attendance Verification', () => {
    it('allows when practitioner was present on session date', () => {
      const attendance: AttendanceDay = {
        employeeId: practitioner1,
        date: '2026-11-01',
        checkIn: '08:30',
        checkOut: '17:00',
        status: 'present',
      }

      const res = verifyPractitionerAttendance({
        practitionerId: practitioner1,
        sessionDate: '2026-11-01',
        attendanceRecord: attendance,
      })

      expect(res.allowed).toBe(true)
    })

    it('disallows when practitioner was absent on session date', () => {
      const attendance: AttendanceDay = {
        employeeId: practitioner1,
        date: '2026-11-01',
        checkIn: null,
        checkOut: null,
        status: 'absent',
      }

      const res = verifyPractitionerAttendance({
        practitionerId: practitioner1,
        sessionDate: '2026-11-01',
        attendanceRecord: attendance,
      })

      expect(res.allowed).toBe(false)
      expect(res.reason).toBe('PRACTITIONER_ABSENT_ON_SESSION_DATE')
    })

    it('disallows when practitioner was on leave', () => {
      const attendance: AttendanceDay = {
        employeeId: practitioner1,
        date: '2026-11-01',
        checkIn: null,
        checkOut: null,
        status: 'leave',
      }

      const res = verifyPractitionerAttendance({
        practitionerId: practitioner1,
        sessionDate: '2026-11-01',
        attendanceRecord: attendance,
      })

      expect(res.allowed).toBe(false)
      expect(res.reason).toBe('PRACTITIONER_ON_LEAVE_ON_SESSION_DATE')
    })

    it('disallows if attendance record employee does not match practitioner', () => {
      const attendance: AttendanceDay = {
        employeeId: 'other-emp',
        date: '2026-11-01',
        checkIn: '09:00',
        checkOut: '17:00',
        status: 'present',
      }

      const res = verifyPractitionerAttendance({
        practitionerId: practitioner1,
        sessionDate: '2026-11-01',
        attendanceRecord: attendance,
      })

      expect(res.allowed).toBe(false)
      expect(res.reason).toBe('ATTENDANCE_RECORD_EMPLOYEE_MISMATCH')
    })
  })

  describe('4. Delivery & Settlement Planning', () => {
    it('consumes package credit when customer has active credits', () => {
      const grantEntry: PackageCreditEntry = {
        id: 'pce-grant-1',
        workspaceId: ws1,
        customerId: cust1,
        packageProductId: pkgProd1,
        entryType: 'GRANT',
        quantity: 10,
        effectiveDate: '2026-11-01',
        createdAt: '2026-11-01T00:00:00Z',
      }

      const res = planServiceDelivery({
        session: baseSession,
        creditEntries: [grantEntry],
        packageProductId: pkgProd1,
        quantity: 1,
      })

      expect(res.session.status).toBe('delivered')
      expect(res.session.settlementMethod).toBe('package_credit')
      expect(res.session.packageCreditId).toBeDefined()
      expect(res.consumptionEntry).not.toBeNull()
      expect(res.consumptionEntry?.entryType).toBe('CONSUME')
      expect(res.consumptionEntry?.quantity).toBe(1)
      expect(res.consumptionEntry?.sourceDocumentType).toBe('service_delivery')
      expect(res.consumptionEntry?.sourceDocumentId).toBe('ses-101')
    })

    it('REFUSES when balance is 0 - it no longer falls back to an unbilled invoice (M4 audit)', () => {
      expect(() =>
        planServiceDelivery({
          session: baseSession,
          creditEntries: [], // 0 credits
          packageProductId: pkgProd1,
        }),
      ).toThrow('INSUFFICIENT_PACKAGE_CREDIT')
    })

    it('settles as complementary when requested WITH a reason', () => {
      const res = planServiceDelivery({
        session: baseSession,
        requestedSettlementMethod: 'complementary',
        reason: 'goodwill',
      })

      expect(res.session.status).toBe('delivered')
      expect(res.session.settlementMethod).toBe('complementary')
      expect(res.session.settlementReason).toBe('goodwill')
      expect(res.session.packageCreditId).toBeNull()
      expect(res.consumptionEntry).toBeNull()
    })

    it('refuses complementary without a reason', () => {
      expect(() =>
        planServiceDelivery({ session: baseSession, requestedSettlementMethod: 'complementary' }),
      ).toThrow('SETTLEMENT_REASON_REQUIRED')
    })

    it('is idempotent when already delivered', () => {
      const deliveredSession: ServiceDeliverySession = {
        ...baseSession,
        status: 'delivered',
        settlementMethod: 'package_credit',
        packageCreditId: 'pce-consume-99',
      }

      const res = planServiceDelivery({
        session: deliveredSession,
      })

      expect(res.session).toBe(deliveredSession)
      expect(res.consumptionEntry).toBeNull()
    })
  })

  describe('5. Cancellation with Credit Reversal', () => {
    it('creates a REVERSAL entry when cancelling a delivered session with package credit', () => {
      const grantEntry: PackageCreditEntry = {
        id: 'pce-grant-1',
        workspaceId: ws1,
        customerId: cust1,
        packageProductId: pkgProd1,
        entryType: 'GRANT',
        quantity: 5,
        effectiveDate: '2026-11-01',
        createdAt: '2026-11-01T00:00:00Z',
      }

      const consumeEntry: PackageCreditEntry = {
        id: 'pce-consume-1',
        workspaceId: ws1,
        customerId: cust1,
        packageProductId: pkgProd1,
        entryType: 'CONSUME',
        quantity: 1,
        effectiveDate: '2026-11-01',
        createdAt: '2026-11-01T10:00:00Z',
      }

      const deliveredSession: ServiceDeliverySession = {
        ...baseSession,
        status: 'delivered',
        settlementMethod: 'package_credit',
        packageCreditId: 'pce-consume-1',
      }

      const res = planServiceDeliveryCancellation({
        session: deliveredSession,
        creditEntries: [grantEntry, consumeEntry],
        reason: 'customer asked',
      })

      expect(res.session.status).toBe('cancelled')
      expect(res.reversalEntry).not.toBeNull()
      expect(res.reversalEntry?.entryType).toBe('REVERSAL')
      expect(res.reversalEntry?.quantity).toBe(1)
      expect(res.reversalEntry?.referenceEntryId).toBe('pce-consume-1')
    })
  })
})
