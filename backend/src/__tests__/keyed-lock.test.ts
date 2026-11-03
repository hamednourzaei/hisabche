import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { serializeBy } from '../utils/keyed-lock'

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('serializeBy', () => {
  it('runs callers of one key one at a time, in arrival order', async () => {
    const log: string[] = []
    const job = (name: string, ms: number) => async () => {
      log.push(`${name}:start`)
      await tick(ms)
      log.push(`${name}:end`)
    }
    await Promise.all([
      serializeBy('c-1', job('a', 15)),
      serializeBy('c-1', job('b', 1)),
      serializeBy('c-1', job('c', 1)),
    ])
    expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end'])
  })

  it('does not hold different keys against each other', async () => {
    const log: string[] = []
    await Promise.all([
      serializeBy('c-1', async () => {
        log.push('1:start')
        await tick(15)
        log.push('1:end')
      }),
      serializeBy('c-2', async () => {
        log.push('2:start')
        await tick(1)
        log.push('2:end')
      }),
    ])
    expect(log.indexOf('2:end')).toBeLessThan(log.indexOf('1:end'))
  })

  it('a failed caller does not wedge the next one, and its error still reaches its own caller', async () => {
    const failing = serializeBy('c-1', async () => {
      throw new Error('boom')
    })
    const next = serializeBy('c-1', async () => 'ok')
    await expect(failing).rejects.toThrow('boom')
    await expect(next).resolves.toBe('ok')
  })

  it('a check-then-write race is closed: the second request sees the first one’s write', async () => {
    let receivable = 600
    const limit = 1000
    const sale = (amount: number) =>
      serializeBy('c-1', async () => {
        const seen = receivable // the read
        await tick(5)
        if (seen + amount > limit) return 'refused'
        receivable = seen + amount // the write
        return 'made'
      })
    const results = await Promise.all([sale(300), sale(300)])
    expect(results.sort()).toEqual(['made', 'refused'])
    expect(receivable).toBe(900)
  })
})

describe('wiring', () => {
  const source = readFileSync(join(__dirname, '../services/invoice.service.ts'), 'utf8')
    .split(/\s+/)
    .join(' ')
  it("a customer's sales are created one at a time", () => {
    expect(source).toContain('serializeBy(`invoice-credit:${ctx.workspaceId}:${customerId}`')
  })
})
