// The rate limiter and the anonymous refresh key are keyed by `request.ip`.
// Without trustProxy that was Render's load balancer for every request — one
// shared bucket for all logged-out users. With `trustProxy: true` it would be
// whatever the client wrote. This pins the only acceptable reading, with a
// real Fastify instance and the exact option index.ts passes.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { trustedProxies } from '../utils/trusted-proxies'

async function ipFor(remoteAddress: string, xff?: string): Promise<string> {
  const app = Fastify({ trustProxy: trustedProxies({}) })
  app.get('/ip', async (request) => ({ ip: request.ip }))
  const res = await app.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress,
    headers: xff ? { 'x-forwarded-for': xff } : {},
  })
  await app.close()
  return (res.json() as { ip: string }).ip
}

const RENDER_LB = '10.201.4.17'
const CF_EDGE = '172.70.1.2'
const CLIENT = '203.0.113.9'
const ATTACKER = '198.51.100.66'

describe('request.ip is the real client', () => {
  it('behind Render only', async () => {
    expect(await ipFor(RENDER_LB, CLIENT)).toBe(CLIENT)
  })

  it('behind Cloudflare and Render', async () => {
    expect(await ipFor(RENDER_LB, `${CLIENT}, ${CF_EDGE}`)).toBe(CLIENT)
  })

  it('two different users behind the same load balancer get two buckets', async () => {
    const a = await ipFor(RENDER_LB, '203.0.113.1')
    const b = await ipFor(RENDER_LB, '203.0.113.2')
    expect(a).not.toBe(b)
  })

  it('⚠️ a forged X-Forwarded-For does not choose the address', async () => {
    // The attacker writes "1.1.1.1"; Render appends the attacker's real one.
    expect(await ipFor(RENDER_LB, `1.1.1.1, ${ATTACKER}`)).toBe(ATTACKER)
    // Forging a Cloudflare address does not help either.
    expect(await ipFor(RENDER_LB, `1.1.1.1, ${CF_EDGE}, ${ATTACKER}`)).toBe(ATTACKER)
  })

  it('⚠️ a public peer is never trusted: its header is ignored', async () => {
    expect(await ipFor(ATTACKER, '1.1.1.1')).toBe(ATTACKER)
  })

  it('TRUSTED_PROXY_CIDRS adds a range without a code change', () => {
    expect(trustedProxies({ TRUSTED_PROXY_CIDRS: ' 192.0.2.0/24 , ' })).toContain('192.0.2.0/24')
  })

  it('index.ts passes exactly this option', () => {
    const src = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(src).toContain('trustProxy: trustedProxies(),')
    expect(src).not.toContain('trustProxy: true')
  })
})
