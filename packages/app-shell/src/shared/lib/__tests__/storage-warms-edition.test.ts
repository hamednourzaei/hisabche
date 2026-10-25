// A device with a licence opens on its own dashboard, not on the sign-in page
// (24 Oct 2026). The edition is read SYNCHRONOUSLY at startup, from a cache that
// `initStorage` fills from the secure store — and the edition was not one of
// the keys it filled, so every launch began as «cloud».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('initStorage warms the edition the app opens in', () => {
  const source = readFileSync(join(__dirname, '..', 'storage.ts'), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

  it('reads the edition back from the secure store with the language and the token', () => {
    const warmed = source.slice(source.indexOf('export async function initStorage'))
    expect(warmed).toContain('STORAGE_KEYS.edition')
    expect(warmed).toContain('STORAGE_KEYS.language')
    expect(warmed).toContain('STORAGE_KEYS.token')
  })
})
