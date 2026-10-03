// ============================================
// Capability: the research job wiring (Phase 2).
// Files: plugins/job-scheduler.plugin.ts, services/blog/research.service.ts
//
// ⚠️ THIS GUARDS TWO THINGS THE SPECIFICATION NAMES EXPLICITLY.
//
// §19: «Every automation must support enable/disable, scope, conditions,
// execution history, retry, failure state, idempotency, audit.» and §30:
// «If the user double-clicks: DO NOT create two articles.»
//
// Both of those are decided by ONE thing in this file: whether the handler is
// TOLD which job it is running, or has to go and look it up. The first version
// of the research handler took no argument and re-read `background_jobs` — which
// on a single instance is merely wasteful, and on TWO makes both instances read
// the same pending row and both call Tavily. The claim that makes a job run once
// was being bypassed by the handler going around it.
//
// So these tests read the SOURCE, because the failure is structural: there is no
// runtime to assert on, and a handler that re-reads the table is perfectly type
// correct.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const PLUGIN = readFileSync(join(__dirname, '..', 'plugins', 'job-scheduler.plugin.ts'), 'utf8')

/** Line comments BEFORE block comments — BUG-029. */
function stripComments(source: string): string {
  return source.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

const CODE = stripComments(PLUGIN)

describe('research job — the handler is TOLD which job it is running', () => {
  it('a job handler takes the job, it does not take nothing', () => {
    // ⚠️ `() => Promise<void>` is the shape that forces a handler to go looking
    // for its own payload, and looking it up is what two instances both do.
    expect(CODE).toMatch(/type JobHandler = \(job: HandlerJob\) => Promise<void>/)
  })

  it('every dispatch passes the claimed row', () => {
    // ⚠️ BOTH paths, not just the modern one. The pre-migration
    // `pollJobsSingleInstance` has no payload at all, so it must say so rather
    // than call a handler with an invented one.
    const dispatches = [...CODE.matchAll(/await handler\(([^)]*)\)/g)].map((m) => m[1]?.trim())
    expect(dispatches.length).toBeGreaterThanOrEqual(2)
    for (const arg of dispatches) {
      expect(arg, 'a handler was called with no job').not.toBe('')
    }
  })

  it('the pre-migration path passes payload: null rather than an empty object', () => {
    // ⚠️ `payload: null` is a REAL state. `{}` would make a handler read
    // `undefined.topic`, start a research run with no topic, and fail somewhere
    // less obvious than the truth.
    expect(CODE).toContain('payload: null')
  })

  it('the research handler does NOT re-read background_jobs', () => {
    // ⚠️ THE ASSERTION THIS FILE EXISTS FOR. If a future edit makes the handler
    // query `background_jobs` again, the claim is bypassed and two instances
    // bill Tavily twice.
    const handler = CODE.slice(
      CODE.indexOf('async function runContentResearch'),
      CODE.indexOf('const JOB_HANDLERS'),
    )
    expect(handler).not.toMatch(/from\('background_jobs'\)/)
    expect(handler).not.toMatch(/jobService\./)
  })
})

describe('research job — it never publishes, and it fails loudly', () => {
  it('no publish call anywhere in the handler', () => {
    // ⚠️ §18: «AI must not automatically publish content.» The furthest this
    // handler goes is a research run and its sources.
    const handler = CODE.slice(
      CODE.indexOf('async function runContentResearch'),
      CODE.indexOf('const JOB_HANDLERS'),
    )
    expect(handler).not.toMatch(/publish/i)
    expect(handler).not.toMatch(/blog_posts/)
  })

  it('a job with no topic or no workspace FAILS rather than skipping', () => {
    // ⚠️ A handler that returns quietly looks identical to a job that was never
    // scheduled, and the first is a bug somebody spends an afternoon on.
    expect(CODE).toContain('CONTENT_RESEARCH_PAYLOAD_INVALID')
  })

  it('a failure marks the brief failed AND rethrows so the job records it', () => {
    // ⚠️ Both. Marking the brief without rethrowing leaves a green job and a
    // red brief; rethrowing without marking leaves a brief stuck in
    // 'researching' for ever, and nobody can tell a stuck pipeline from a slow
    // one.
    const handler = CODE.slice(
      CODE.indexOf('async function runContentResearch'),
      CODE.indexOf('const JOB_HANDLERS'),
    )
    expect(handler).toContain("intelligence_status: 'failed'")
    expect(handler).toMatch(/throw err/)
  })

  it('only advances the brief when sources PERSISTED, not when Tavily returned them', () => {
    // ⚠️ A brief marked `brief_ready` with zero sources is a brief written from
    // model guesswork with nothing to check it against — the failure §8 exists
    // to prevent. And the count must come from the DATABASE: the first version
    // checked `result.sources.length` (the in-memory provider list), so a run
    // where every insert failed still marked the brief ready over an empty
    // citation table — a green status over lost data.
    expect(CODE).toMatch(/saved\.sourceIds\.length > 0 && saved\.failed === 0/)
    expect(CODE).toMatch(/ready \? 'brief_ready' : 'failed'/)
    expect(CODE).not.toMatch(/result\.sources\.length > 0 \?/)
  })
})

describe('research job — the tenant comes from the payload, and that is deliberate', () => {
  it('builds a context because a scheduled job has no session', () => {
    // ⚠️ A job wakes on a timer; it cannot ask `authenticate` who is calling.
    // The workspace comes from a payload written by an admin-authorised route,
    // and that route is the thing that makes this safe.
    expect(CODE).toMatch(/workspaceId = typeof payload\.workspaceId === 'string'/)
    expect(CODE).toMatch(/as TenancyContext/)
  })
})
