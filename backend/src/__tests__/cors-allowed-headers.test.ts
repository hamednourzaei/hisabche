// Creating an invoice on hisabche.com failed with:
//   "Request header field idempotency-key is not allowed by
//    Access-Control-Allow-Headers in preflight response."
// The API client sends `Idempotency-Key`; the CORS allow-list did not name it.
// Every non-safelisted header the shared API client sends must be allowed.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../..')
const index = readFileSync(join(ROOT, 'backend/src/index.ts'), 'utf8')
const allowed = [
  ...(index.match(/allowedHeaders:\s*\[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g),
].map((m) => m[1]!.toLowerCase())

// Headers a browser sends without asking (CORS-safelisted), or that are not
// request headers at all.
const SAFELISTED = new Set(['accept', 'accept-language', 'content-language', 'content-type'])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : files(p)
    return /\.tsx?$/.test(name) ? [p] : []
  })
}

describe('CORS allow-list covers the headers the web client sends', () => {
  const sent = new Set<string>()
  for (const file of files(join(ROOT, 'packages/api/src'))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/headers(?:\[\s*|:\s*\{\s*)'([A-Za-z][A-Za-z-]+)'/g))
      sent.add(m[1]!.toLowerCase())
  }

  it('found the client headers', () => {
    expect(sent).toContain('idempotency-key')
  })

  it('allows every non-safelisted header', () => {
    expect([...sent].filter((h) => !SAFELISTED.has(h) && !allowed.includes(h))).toEqual([])
  })
})
