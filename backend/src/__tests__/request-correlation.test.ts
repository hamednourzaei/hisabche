// PART 6 / Phase J: every request is traceable with a safe, caller-quotable id.

import { describe, expect, it, vi } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  CORRELATION_HEADER,
  correlateRequests,
  correlationOf,
} from '../middleware/correlation.middleware'

function fake(headers: Record<string, unknown>) {
  const request = { headers } as unknown as FastifyRequest
  const reply = {
    header: vi.fn((_name: string, _value: string) => reply),
  }
  return { request, reply: reply as unknown as FastifyReply, spy: reply.header }
}

describe('request correlation (PART 6 Phase J)', () => {
  it('propagates a safe caller-supplied id verbatim', async () => {
    const { request, reply, spy } = fake({ [CORRELATION_HEADER]: 'trace-abc_1' })
    await correlateRequests(request, reply)
    expect(correlationOf(request)).toBe('trace-abc_1')
    expect(spy).toHaveBeenCalledWith(CORRELATION_HEADER, 'trace-abc_1')
  })

  it('generates an id when none is supplied', async () => {
    const { request, reply, spy } = fake({})
    await correlateRequests(request, reply)
    expect(correlationOf(request)).toMatch(/^[0-9a-f-]{36}$/)
    expect(spy).toHaveBeenCalled()
  })

  it('refuses a hostile header instead of echoing it into a response', async () => {
    const { request, reply, spy } = fake({ [CORRELATION_HEADER]: 'bad\ninjected: header' })
    await correlateRequests(request, reply)
    const echoed = spy.mock.calls[0]?.[1]
    expect(String(echoed)).not.toContain('\n')
    expect(String(echoed)).toMatch(/^[0-9a-f-]{36}$/)
  })
})
