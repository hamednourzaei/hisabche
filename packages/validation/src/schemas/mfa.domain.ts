// ============================================
// packages/validation/src/schemas/mfa.domain.ts
//
// OPTION 47: CUSTOMER MFA & STEP-UP VERIFICATION
//
// Recovery codes generator, verification logic, step-up check.
// ============================================

export interface MfaRecoveryCode {
  readonly code: string
  readonly used: boolean
}

/**
 * Format a raw random string into a user-friendly recovery code: XXXX-XXXX
 */
export function formatRecoveryCode(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (clean.length < 8) return clean
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`
}

/**
 * Generate N deterministic recovery code templates.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // Base32 unambiguous
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`)
  }
  return codes
}

/**
 * Check whether a candidate recovery code matches a stored code (case- and dash-insensitive).
 */
export function matchRecoveryCode(candidate: string, stored: string): boolean {
  const normA = candidate.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const normB = stored.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return normA.length > 0 && normA === normB
}
