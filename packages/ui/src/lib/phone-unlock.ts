// ============================================
// The phone's own lock, as a proof (WebAuthn, platform authenticator).
//
// The employee's attendance page asks the phone to make a key once, and to
// sign each submission with it. The phone only signs after its owner unlocks
// it — fingerprint, face or PIN, whichever the phone has. The page never sees
// any of those; it sees a public key and signatures.
//
// ⚠️ EVERYTHING HERE READS `window`, so it is called from event handlers only —
// never during render. `canUsePhoneUnlock` is asked inside an effect.
// ⚠️ The challenge is not random: it is the SHA-256 of the very form being
// sent (`@hisabche/validation` builds the text). A signature is good for that
// form and no other.
// ============================================

import {
  UNLOCK_ALGORITHMS,
  unlockEnrollmentMessage,
  unlockSubmissionMessage,
  type UnlockSubmissionFields,
} from '@hisabche/validation'

export interface PhoneEnrollment {
  credentialId: string
  publicKey: string
  algorithm: number
  clientDataJSON: string
  authenticatorData: string
  clientRequestId: string
}

export interface PhoneAssertion {
  credentialId: string
  clientDataJSON: string
  authenticatorData: string
  signature: string
}

/** Why the phone gave nothing back. */
export type PhoneUnlockFailure = 'unsupported' | 'cancelled'

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  return btoa(binary).split('+').join('-').split('/').join('_').split('=').join('')
}

function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.split('-').join('+').split('_').join('/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

async function challengeOf(message: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
}

/** Does this browser have a lock it can vouch with? Ask after mount. */
export async function canUsePhoneUnlock(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.PublicKeyCredential !== 'function') {
    return false
  }
  if (!window.isSecureContext || !crypto?.subtle) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Ask the phone to make a key for this employee. The phone shows its own
 * prompt; a person who closes it gets `cancelled`.
 */
export async function enrollPhone(input: {
  token: string
  clientRequestId: string
  /** Shown by the phone in its own prompt. */
  personName: string
  appName: string
}): Promise<PhoneEnrollment | PhoneUnlockFailure> {
  if (!(await canUsePhoneUnlock())) return 'unsupported'
  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        challenge: await challengeOf(unlockEnrollmentMessage(input.token, input.clientRequestId)),
        // The key is bound to this page's own host; the server checks exactly that.
        rp: { id: window.location.hostname, name: input.appName },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: input.personName,
          displayName: input.personName,
        },
        pubKeyCredParams: UNLOCK_ALGORITHMS.map((alg) => ({ type: 'public-key' as const, alg })),
        authenticatorSelection: {
          // The phone itself — not a security key, not another device.
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        attestation: 'none',
        timeout: 60_000,
      },
    })
  } catch {
    return 'cancelled'
  }
  if (!credential) return 'cancelled'
  const made = credential as PublicKeyCredential
  const response = made.response as AuthenticatorAttestationResponse
  const publicKey = response.getPublicKey?.()
  if (!publicKey || typeof response.getAuthenticatorData !== 'function') return 'unsupported'
  return {
    credentialId: toBase64Url(made.rawId),
    publicKey: toBase64Url(publicKey),
    algorithm: response.getPublicKeyAlgorithm(),
    clientDataJSON: toBase64Url(response.clientDataJSON),
    authenticatorData: toBase64Url(response.getAuthenticatorData()),
    clientRequestId: input.clientRequestId,
  }
}

/** Ask the registered phone to sign this one form. */
export async function signWithPhone(input: {
  token: string
  credentialId: string
  fields: UnlockSubmissionFields
}): Promise<PhoneAssertion | PhoneUnlockFailure> {
  if (!(await canUsePhoneUnlock())) return 'unsupported'
  let credential: Credential | null
  try {
    credential = await navigator.credentials.get({
      publicKey: {
        challenge: await challengeOf(unlockSubmissionMessage(input.token, input.fields)),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(input.credentialId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    })
  } catch {
    return 'cancelled'
  }
  if (!credential) return 'cancelled'
  const made = credential as PublicKeyCredential
  const response = made.response as AuthenticatorAssertionResponse
  return {
    credentialId: toBase64Url(made.rawId),
    clientDataJSON: toBase64Url(response.clientDataJSON),
    authenticatorData: toBase64Url(response.authenticatorData),
    signature: toBase64Url(response.signature),
  }
}
