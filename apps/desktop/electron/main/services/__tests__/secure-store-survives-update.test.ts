// A sign-in must survive an update or a reinstall (owner, 24 Oct 2026).
// The store used to delete an entry on ANY failed read, decided «encrypted or
// not» from the OS state at READ time, and wrote with truncate-then-write.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let userData = ''
let encryptionAvailable = true

jest.mock('electron', () => ({
  app: { getPath: () => userData },
  safeStorage: {
    isEncryptionAvailable: () => encryptionAvailable,
    // «Encryption» that is visibly not the plain text.
    encryptString: (text: string) =>
      Buffer.from(Buffer.from(text, 'utf8').toString('base64'), 'utf8'),
    decryptString: (buffer: Buffer) => {
      const text = Buffer.from(buffer.toString('utf8'), 'base64').toString('utf8')
      // A real decryptor throws on bytes it did not produce.
      if (Buffer.from(text, 'utf8').toString('base64') !== buffer.toString('utf8')) {
        throw new Error('not encrypted by safeStorage')
      }
      return text
    },
  },
}))

import { secureDelete, secureGet, secureSet } from '../secure-store'

const vault = () => join(userData, 'vault')
const file = (key: string) => join(vault(), `${key}.bin`)

beforeEach(() => {
  userData = mkdtempSync(join(tmpdir(), 'secure-store-'))
  encryptionAvailable = true
})
afterEach(() => rmSync(userData, { recursive: true, force: true }))

describe('the vault across an update', () => {
  it('round-trips a value, encrypted on disk', () => {
    secureSet('hisabche.session', '{"token":"abc"}')
    expect(secureGet('hisabche.session')).toBe('{"token":"abc"}')
    expect(readFileSync(file('hisabche.session')).toString('utf8')).not.toContain('abc')
  })

  it('a key service that is not ready yet is «not now», and the entry is KEPT', () => {
    secureSet('hisabche.licence.code', 'CODE-1')
    encryptionAvailable = false
    expect(secureGet('hisabche.licence.code')).toBeNull()
    expect(existsSync(file('hisabche.licence.code'))).toBe(true)

    encryptionAvailable = true
    expect(secureGet('hisabche.licence.code')).toBe('CODE-1')
  })

  it('an entry written while the key service was down is read back plain, later', () => {
    encryptionAvailable = false
    secureSet('hisabche.edition', 'offline')
    encryptionAvailable = true
    expect(secureGet('hisabche.edition')).toBe('offline')
  })

  it('an unreadable file is never deleted by a read', () => {
    secureSet('hisabche.session', 'good')
    writeFileSync(file('hisabche.session'), Buffer.from([0x01, 0xff, 0xfe, 0xfd]))
    expect(secureGet('hisabche.session')).toBeNull()
    expect(existsSync(file('hisabche.session'))).toBe(true)
  })

  it('a main file cut short falls back to the previous good value', () => {
    secureSet('hisabche.session', 'first')
    secureSet('hisabche.session', 'second')
    writeFileSync(file('hisabche.session'), Buffer.from([0x01, 0xff])) // an update killed the write
    expect(secureGet('hisabche.session')).toBe('first')
  })

  it('an entry from before the marker existed is still read', () => {
    mkdirSync(vault(), { recursive: true })
    writeFileSync(
      file('legacy'),
      Buffer.from(Buffer.from('old-session', 'utf8').toString('base64'), 'utf8'),
    )
    expect(secureGet('legacy')).toBe('old-session')
    writeFileSync(file('legacy-plain'), 'plain-old')
    expect(secureGet('legacy-plain')).toBe('plain-old')
  })

  it('signing out removes the value AND its backup — it does not come back', () => {
    secureSet('hisabche.session', 'a')
    secureSet('hisabche.session', 'b')
    secureDelete('hisabche.session')
    expect(secureGet('hisabche.session')).toBeNull()
    expect(existsSync(`${file('hisabche.session')}.bak`)).toBe(false)
  })
})
