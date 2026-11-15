// ============================================
// cache.exists() does not wait for an unreachable Redis.
//
// get/set/del answered from the in-process store while Redis was down; exists() alone went to
// the client and waited out its retries — seconds per call, on a check many requests make.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'services', 'cache.service.ts'), 'utf8')

describe('cache.exists while Redis is down', () => {
  it('answers from the in-process store before touching the client', () => {
    const body = source.slice(source.indexOf('async exists(key: string)'))
    const offline = body.indexOf('if (!this.isConnected) return fallbackGet(key) !== null')
    const client = body.indexOf('await this.client.exists(key)')
    expect(offline).toBeGreaterThan(-1)
    expect(offline).toBeLessThan(client)
  })
})
