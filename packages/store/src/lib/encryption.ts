// packages/store/src/lib/encryption.ts
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'hisabche-dev-key-32-chars!!'

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