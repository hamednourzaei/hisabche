// packages/store/src/lib/encryption.ts
import CryptoJS from 'crypto-js'

// The `typeof process` guard keeps this safe in the Electron renderer, which
// has no Node globals — an unguarded read threw at import and blanked the app.
// The literal `process.env.NEXT_PUBLIC_…` text must stay intact for Next to
// substitute it at build time.
const ENCRYPTION_KEY =
  (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ENCRYPTION_KEY : undefined) ||
  'hisabche-dev-key-32-chars!!'

export const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

export const decrypt = (ciphertext: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export const encryptObject = <T extends Record<string, unknown>>(obj: T): string => {
  return encrypt(JSON.stringify(obj))
}

export const decryptObject = <T>(ciphertext: string): T => {
  return JSON.parse(decrypt(ciphertext)) as T
}
