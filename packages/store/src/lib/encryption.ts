// packages/store/src/lib/encryption.ts
import CryptoJS from 'crypto-js'

// The `typeof process` guard keeps this safe in the Electron renderer, which
// has no Node globals — an unguarded read threw at import and blanked the app.
// The literal `process.env.NEXT_PUBLIC_…` text must stay intact for Next to
// substitute it at build time.
const ENV_ENCRYPTION_KEY =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ENCRYPTION_KEY : undefined

function resolveEncryptionKey(): string {
  if (ENV_ENCRYPTION_KEY && ENV_ENCRYPTION_KEY.trim().length >= 16) {
    return ENV_ENCRYPTION_KEY
  }
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_ENCRYPTION_KEY (>= 16 chars) is required in production for client storage encryption.',
    )
  }
  return 'hisabche-dev-key-32-chars!!'
}

export const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, resolveEncryptionKey()).toString()
}

export const decrypt = (ciphertext: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, resolveEncryptionKey())
  return bytes.toString(CryptoJS.enc.Utf8)
}

export const encryptObject = <T extends Record<string, unknown>>(obj: T): string => {
  return encrypt(JSON.stringify(obj))
}

export const decryptObject = <T>(ciphertext: string): T => {
  return JSON.parse(decrypt(ciphertext)) as T
}
