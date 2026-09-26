// ============================================
// emailService.send writes the email down before sending it, sends it as the
// claim holder, and keeps the old in-process path only until the migration
// runs. The claim semantics themselves: email-outbox.pg.test.ts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const insertResult = vi.fn()
const rpc = vi.fn()
vi.mock('../db', () => ({
  supabase: {
    from: () => ({ insert: () => ({ select: () => ({ single: () => insertResult() }) }) }),
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))
vi.mock('../utils/pagination', () => ({
  memoryCache: { get: vi.fn(), set: vi.fn(), invalidate: vi.fn() },
}))

const { emailService } = await import('../services/email.service')
const { WORKER_ID } = await import('../services/distributed-work')
const { retryDelaySeconds } = await import('../services/email-outbox')

const row = {
  id: 'mail-1',
  to_email: 'a@b.c',
  subject: 'S',
  html: '<p>x</p>',
  attempts: 1,
  max_attempts: 5,
}
const rpcNames = () => rpc.mock.calls.map((c) => c[0])

beforeEach(() => {
  insertResult.mockReset()
  rpc.mockReset()
  vi.restoreAllMocks()
})

describe('send()', () => {
  it('writes the row, claims THAT row, sends with the row id as idempotency key, completes', async () => {
    insertResult.mockResolvedValue({ data: { id: 'mail-1' }, error: null })
    rpc.mockImplementation(async (name: string) =>
      name === 'claim_email_outbox' ? { data: [row], error: null } : { data: true, error: null },
    )
    const send = vi
      .spyOn(emailService, '_send')
      .mockResolvedValue({ success: true, id: 'resend-9' })

    expect(await emailService.send({ to: 'a@b.c', subject: 'S', html: '<p>x</p>' })).toEqual({
      success: true,
    })
    expect(send).toHaveBeenCalledWith('a@b.c', 'S', '<p>x</p>', 'mail-1')
    expect(rpcNames()).toEqual(['claim_email_outbox', 'complete_email_outbox'])
    expect(rpc.mock.calls[0]![1]).toMatchObject({ p_worker: WORKER_ID, p_id: 'mail-1', p_limit: 1 })
    expect(rpc.mock.calls[1]![1]).toMatchObject({
      p_id: 'mail-1',
      p_worker: WORKER_ID,
      p_provider_id: 'resend-9',
    })
  })

  it('a provider failure is recorded with backoff, for the poller to retry — not dropped', async () => {
    insertResult.mockResolvedValue({ data: { id: 'mail-1' }, error: null })
    rpc.mockImplementation(async (name: string) =>
      name === 'claim_email_outbox'
        ? { data: [row], error: null }
        : { data: 'pending', error: null },
    )
    vi.spyOn(emailService, '_send').mockResolvedValue({
      success: false,
      error: { message: 'rate limited' },
    })

    expect(await emailService.send({ to: 'a@b.c', subject: 'S', html: '<p>x</p>' })).toEqual({
      success: false,
      error: 'retry',
    })
    expect(rpcNames()).toEqual(['claim_email_outbox', 'fail_email_outbox'])
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_retry_delay_seconds: 60 })
  })

  it('another instance already holds the row: nothing is sent twice', async () => {
    insertResult.mockResolvedValue({ data: { id: 'mail-1' }, error: null })
    rpc.mockResolvedValue({ data: [], error: null })
    const send = vi.spyOn(emailService, '_send')
    expect(await emailService.send({ to: 'a@b.c', subject: 'S', html: 'h' })).toEqual({
      success: true,
      queued: true,
    })
    expect(send).not.toHaveBeenCalled()
  })

  it('before the migration: the in-process queue, as before — never silently dropped', async () => {
    insertResult.mockResolvedValue({ data: null, error: { code: '42P01' } })
    const send = vi.spyOn(emailService, '_send').mockResolvedValue({ success: true })
    expect(await emailService.send({ to: 'a@b.c', subject: 'S', html: 'h' })).toEqual({
      success: true,
    })
    expect(send).toHaveBeenCalledWith('a@b.c', 'S', 'h')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('drainOutbox()', () => {
  it('not installed yet: null, nothing sent', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
    expect(await emailService.drainOutbox()).toBeNull()
  })

  it('sends every claimed email and counts the outcomes', async () => {
    rpc.mockImplementation(async (name: string) =>
      name === 'claim_email_outbox'
        ? { data: [row, { ...row, id: 'mail-2' }], error: null }
        : { data: true, error: null },
    )
    vi.spyOn(emailService, '_send').mockResolvedValue({ success: true })
    expect(await emailService.drainOutbox()).toEqual({ sent: 2, retry: 0, failed: 0, lost: 0 })
  })
})

describe('backoff', () => {
  it('1, 2, 4, 8 minutes … capped at an hour', () => {
    expect([1, 2, 3, 4, 10].map(retryDelaySeconds)).toEqual([60, 120, 240, 480, 3600])
  })
})

describe('source guards', () => {
  const code = (p: string) =>
    readFileSync(join(__dirname, '..', p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('every instance polls the outbox', () => {
    expect(code('plugins/job-scheduler.plugin.ts')).toMatch(
      /setInterval\(\(\) => void pollEmailOutbox\(\)/,
    )
  })

  it('the provider receives the idempotency key', () => {
    expect(code('services/email.service.ts')).toContain(
      'idempotencyKey ? { idempotencyKey } : undefined',
    )
  })
})
