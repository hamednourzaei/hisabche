// ============================================
// packages/ui/src/components/ui/service-delivery/service-delivery-errors.ts
//
// Server text is not a translation. Every refusal the service-delivery core
// can answer is listed HERE, by code, and each one has a sentence in the three
// catalogs; a code this build does not know falls back to «could not be
// completed» — never to the server's English sentence, and never to a
// different meaning.
//
// The list is closed on purpose: `backend/src/services/service-delivery/
// service-delivery.service.ts` (`failureOf`) and the domain's thrown codes are
// what it covers.
// ============================================

import { apiErrorCode, apiErrorMessage } from '@hisabche/api'

/** Codes the domain or the service can refuse a create/deliver/cancel with. */
export const SERVICE_DELIVERY_ERROR_CODES = [
  'INVALID_STATUS_TRANSITION',
  'SETTLEMENT_PACKAGE_REQUIRED',
  'INSUFFICIENT_PACKAGE_CREDIT',
  'SETTLEMENT_INVOICE_REQUIRED',
  'SETTLEMENT_INVOICE_INVALID',
  'SETTLEMENT_REASON_REQUIRED',
  'CANCELLATION_REASON_REQUIRED',
  'SESSION_CHANGED',
  'SESSION_ALREADY_DELIVERED_DIFFERENTLY',
  'DELIVERED_INVOICE_CORRECTION_REQUIRED',
  'CREDIT_REFERENCE_MISSING',
  'PRACTITIONER_ABSENT_ON_SESSION_DATE',
  'PRACTITIONER_ON_LEAVE_ON_SESSION_DATE',
  'PRACTITIONER_ATTENDANCE_FAILED',
  'SESSION_MUST_START_SCHEDULED',
  'SESSION_END_BEFORE_START',
  'CUSTOMER_ID_REQUIRED',
  'SERVICE_OFFERING_ID_REQUIRED',
  'SESSION_DATE_REQUIRED',
  'SESSION_TIMES_REQUIRED',
  'CONSUMPTION_QUANTITY_MUST_BE_POSITIVE',
  'SERVICE_DELIVERY_MIGRATION_REQUIRED',
  'WORKSPACE_REQUIRED',
] as const

/**
 * The machine code behind a failed request.
 *
 * `apiErrorCode` is preferred; the server also puts the code first in the
 * message (`failureOf` maps a database code to it), which is the second place
 * to look. Nothing else — no guessing from an HTTP status.
 */
export function serviceDeliveryErrorCode(error: unknown): string | undefined {
  const code = apiErrorCode(error)
  if (code) return code
  const message = apiErrorMessage(error, '')
  return /\b([A-Z][A-Z0-9_]{5,})\b/.exec(message)?.[1]
}

/** The translation key for one code, for `t()` — never the server's sentence. */
export function serviceDeliveryErrorKey(code: string | undefined): string {
  if (!code) return 'serviceDelivery.errors.unknown'
  if (code.startsWith('INVALID_STATUS_TRANSITION')) {
    return 'serviceDelivery.errors.INVALID_STATUS_TRANSITION'
  }
  return (SERVICE_DELIVERY_ERROR_CODES as readonly string[]).includes(code)
    ? `serviceDelivery.errors.${code}`
    : 'serviceDelivery.errors.unknown'
}
