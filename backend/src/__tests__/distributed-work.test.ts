// ============================================
// The TypeScript side of multi-instance background work: it only calls the
// Postgres functions (proven in distributed-work.pg.test.ts), and before the
// migration it keeps the single-instance behaviour instead of failing.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../db', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const { claimJobs, runScheduledOnce, slotOf, WORKER_ID } =
  await import('../services/distributed-work')

const missing = { data: null, error: { code: 'PGRST202', message: 'not found' } }

beforeEach(() => rpc.mockReset())

describe('runScheduledOnce', () => {
  it('runs only when this instance won the slot, and records the finish', async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const run = vi.fn(async () => {})
    expect(await runScheduledOnce('t', 's', run)).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0]![0]).toBe('claim_scheduled_run')
    expect(rpc.mock.calls[1]![0]).toBe('finish_scheduled_run')
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_holder: WORKER_ID, p_error: null })
  })

  it('⚠️ another instance won the slot: this one does not run it', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null })
    const run = vi.fn(async () => {})
    expect(await runScheduledOnce('t', 's', run)).toBe(false)
    expect(run).not.toHaveBeenCalled()
  })

  it('a failing run is still closed, with its error, so the next slot is not blocked', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await expect(
      runScheduledOnce('t', 's', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(rpc.mock.calls[1]![1]).toMatchObject({ p_error: 'boom' })
  })

  it('before the migration: runs as before (single instance), never silently skips', async () => {
    rpc.mockResolvedValueOnce(missing)
    const run = vi.fn(async () => {})
    expect(await runScheduledOnce('t', 's', run)).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('claimJobs', () => {
  it('before the migration: null ("not configured"), so the old path is used', async () => {
    rpc.mockResolvedValueOnce(missing)
    expect(await claimJobs()).toBeNull()
  })
  it('claims under this process id', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'j1' }], error: null })
    expect(await claimJobs(3)).toEqual([{ id: 'j1' }])
    expect(rpc.mock.calls[0]).toEqual([
      'claim_background_jobs',
      expect.objectContaining({ p_worker: WORKER_ID, p_limit: 3 }),
    ])
  })
})

describe('slotOf', () => {
  it('the same tick is the same slot on every instance', () => {
    const t = new Date('2026-09-26T00:00:07Z')
    expect(slotOf(86_400, t)).toBe(slotOf(86_400, new Date('2026-09-26T23:59:59Z')))
    expect(slotOf(86_400, t)).not.toBe(slotOf(86_400, new Date('2026-09-27T00:00:00Z')))
  })
})

describe('⚠️ nothing in the process runs background work unguarded', () => {
  const code = (p: string) =>
    readFileSync(join(__dirname, '..', p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it('every cron task goes through runScheduledOnce', () => {
    const src = code('scheduler/index.ts')
    const crons = src.match(/cron\.schedule\(/g) ?? []
    const guarded = src.match(/await run(TrialExpiration|EventRecovery)Tick\(\)/g) ?? []
    expect(crons.length).toBeGreaterThan(0)
    expect(guarded).toHaveLength(crons.length)
    expect(src).not.toMatch(/trialWorker\.run\(\)\s*\n\s*\}\s*catch/)
  })

  it('the job poller claims atomically instead of read-then-mark', () => {
    const src = code('plugins/job-scheduler.plugin.ts')
    expect(src).toContain('await claimJobs(')
    expect(src).toMatch(/setInterval\(\(\) => void pollJobs\(\)/)
  })
})

describe('no per-row lookups (N+1) on these paths', () => {
  const code = (p: string) =>
    readFileSync(join(__dirname, '..', p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  it("⚠️ overdue notifications use the invoice's own workspace, with no query per invoice", () => {
    const src = code('plugins/job-scheduler.plugin.ts')
    expect(src).toContain('due_date, workspace_id')
    expect(src).not.toContain('.from("workspace_members")')
  })

  it("an invoice's approval workflows are checked in one query, not one per workflow", () => {
    const src = code('services/invoice.service.ts')
    expect(src).toContain(".in('id', decision.workflowIds)")
    expect(src).not.toMatch(/for \(const workflowId of decision\.workflowIds\)/)
  })
})
