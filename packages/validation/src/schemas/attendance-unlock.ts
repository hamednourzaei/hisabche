// ============================================
// Attendance through an employee's link, confirmed by the phone's own lock.
//
// The phone signs a CHALLENGE. Here the challenge is not a random number the
// server hands out — it is the SHA-256 of the very thing being sent. So a
// signature is good for exactly one submission: replaying a captured one
// repeats the same form (same `clientRequestId`), which the server already
// answers once.
//
// This file only builds the text both sides hash. The page hashes it with
// WebCrypto, the server with node:crypto; neither is imported here.
// ============================================

/** COSE algorithm ids a phone may register: ES256 and RS256. */
export const UNLOCK_ALGORITHMS = [-7, -257] as const
export type UnlockAlgorithm = (typeof UNLOCK_ALGORITHMS)[number]

export interface UnlockSubmissionFields {
  date: string
  status: string
  /** Exactly as sent — `HH:MM` or null. */
  checkIn: string | null
  checkOut: string | null
  endsNextDay: boolean
  clientRequestId: string
}

/** What a submission's signature covers. */
export function unlockSubmissionMessage(token: string, fields: UnlockSubmissionFields): string {
  return [
    'hisabche-attendance-submit-v1',
    token,
    fields.date,
    fields.status,
    fields.checkIn ?? '',
    fields.checkOut ?? '',
    fields.endsNextDay ? '1' : '0',
    fields.clientRequestId,
  ].join('\n')
}

/** What registering a phone covers. */
export function unlockEnrollmentMessage(token: string, clientRequestId: string): string {
  return ['hisabche-attendance-enroll-v1', token, clientRequestId].join('\n')
}
