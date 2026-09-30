// ============================================
// Phase 0 — the job runtime has exactly one authority.
//
// ⚠️ WHY THIS GUARD EXISTS.
//
// Phase 0 of the Business OS found THREE job mechanisms in `backend/src`, none
// of which could see each other:
//
//   1. `src/queue.ts`            InProcessQueue — an in-memory Map of arrays.
//                                No persistence: a restart loses every queued
//                                job. No claim, so two instances both run it.
//                                Its three "job types" (pdf / email / report)
//                                are three functions with no caller anywhere
//                                in the repo.
//
//   2. `src/queue/pdf-queue.ts`  A SEPARATE BullMQ queue with its own
//                                `REDIS_URL`, its own bucket, its own worker
//                                — parallel to the shared Redis that
//                                `shared-rate-limit-store` and `email_outbox`
//                                use. `enqueuePdfJob` has no caller; the live
//                                PDF path is `routes/invoice-pdf.routes.ts`.
//
//   3. `src/services/distributed-work.ts`
//                                The real one. Every guarantee lives in
//                                Postgres: FOR UPDATE SKIP LOCKED claims,
//                                completion conditional on still holding the
//                                claim, one scheduled run per slot across all
//                                instances.
//
// Adding a capability to mechanism 1 or 2 would be correct today and wrong after
// the first restart, on the first second Render runs two instances, or the first
// time a PDF's Redis connection is down while the rest of the system is fine.
// That is the same failure the multi-instance round of 26 September closed, and
// this guard is what stops it being reopened one queue at a time.
//
// ⚠️ WHAT IS *NOT* CLAIMED HERE.
//
// This does not prove the surviving mechanism is correct —
// `distributed-work.test.ts` and `distributed-work.pg.test.ts` do that. It
// proves there is only one place a job can be declared, so a new capability has
// exactly one authority to be built on.
//
// Comments are stripped before matching, so the explanation above cannot
// itself satisfy or break the guard.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

// Remove comments first.
//
// ⚠️ Line comments BEFORE block comments. A glob written inside a line comment
// (a SQL path, or a note naming a source file) opens a FAKE block comment that
// swallows everything up to the next closing marker — which is how
// `rls-coverage.test.ts` once reported 49 tenant tables as having no RLS
// (BUG-029). Same order, same reason.
//
// ⚠️ And note what happened while writing THIS file: the first draft explained
// that bug with the offending glob spelled out inside a block comment above.
// The glob's trailing star closed the comment early, and the parser then read
// the rest of the English as TypeScript. The lesson is not "write shorter
// comments" — it is that a comment explaining a parser hazard is itself subject
// to the parser, so it must be written so it cannot express the hazard.
function stripComments(source: string): string {
  return source.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : []
  })
}

const FILES = walk(SRC).map((path) => ({
  path,
  relative: path
    .slice(SRC.length + 1)
    .split('\\')
    .join('/'),
  code: stripComments(readFileSync(path, 'utf8')),
}))

/**
 * A queue or worker of its OWN — the thing that is actually dangerous, because
 * it claims no slot and loses work on restart.
 *
 * ⚠️ Deliberately NOT `setInterval`. A timer is not a queue. The repo has five
 * legitimate timers and all five are consumers of the authority below, not
 * rivals to it:
 *
 *   plugins/job-scheduler.plugin.ts  polls, and each poll CLAIMS through
 *                                    claimJobs before doing anything
 *   scheduler/index.ts               cron ticks, and each tick calls
 *                                    runScheduledOnce — the first instance to
 *                                    take the slot in Postgres runs it
 *   services/instance-registry.ts    a Redis heartbeat for the admin servers
 *                                    page; observation only, decides nothing
 *   services/sync-stream.ts          one poller per workspace, not per device;
 *                                    it reads a head number and the client
 *                                    still pulls over HTTP, so a duplicate tick
 *                                    is a duplicate read and never a duplicate
 *                                    write
 *   routes/sync-stream.routes.ts     per-connection heartbeat on an open
 *                                    WebSocket, torn down with the socket
 *   routes/system-metrics.routes.ts  a sampling timer for the metrics gauge
 *
 * Banning timers would have flagged all six. They are the *shape* a
 * multi-instance-safe poller takes here: many clocks, one claim. What must
 * never appear is a second set of claimable jobs.
 */
const OWN_RUNTIME = new RegExp(
  [
    'new' + '\\s+Queue\\(',
    'new' + '\\s+Worker\\(',
    'new' + '\\s+InProcessQueue',
    'new' + '\\s+FlowProducer\\(',
    'new' + '\\s+QueueEvents\\(',
  ].join('|'),
)

/**
 * The one permitted claim authority.
 *
 * `distributed-work.ts` wraps the Postgres claim functions; `email-outbox.ts`
 * is a second authority only because a password-reset token has a different
 * durability requirement from a background job. A file listed here owns its
 * runtime, so finding a queue inside it proves nothing.
 *
 * ⚠️ The guard's own file is exempt too, for a reason worth naming: the
 * patterns above are built by concatenation, because writing them literally
 * would make this file the one file that declares a queue. A source-scanning
 * guard that matches its own vocabulary is the classic version of the bug in
 * BUG-029 — the comment the guard was written to catch.
 */
const JOB_AUTHORITIES = [
  'services/distributed-work.ts',
  'services/email-outbox.ts',
  '__tests__/job-authority-guard.test.ts',
]

/** Timers that exist today, each with the reason it is safe. See OWN_RUNTIME. */
const TIMER_CONSUMERS = new Set([
  'plugins/job-scheduler.plugin.ts', // polls and CLAIMS
  'scheduler/index.ts', // cron ticks, each runScheduledOnce
  'services/instance-registry.ts', // heartbeat for the admin page
  'services/sync-stream.ts', // one per workspace, reads only
  'routes/sync-stream.routes.ts', // per-WebSocket, torn down with the socket
  'routes/system-metrics.routes.ts', // metrics sampling
])

/** Tests assert on these classes by name; finding one in a test is the point. */
const TEST_DIR = '__tests__/'

describe('the job runtime has one authority', () => {
  it('finds the files this guard actually inspects (never a silent empty scan)', () => {
    expect(FILES.length).toBeGreaterThan(50)
  })

  it('no file outside the job authorities declares a queue or worker of its own', () => {
    const offenders = FILES.filter(
      (f) => !JOB_AUTHORITIES.includes(f.relative) && OWN_RUNTIME.test(f.code),
    ).map((f) => f.relative)

    expect(offenders).toEqual([])
  })

  it('every timer in the backend is a poller that claims, or is per-connection', () => {
    // The rule, stated positively so it can be read as a rule: a timer that
    // does real work has to go through a claim. A timer nobody claimed is the
    // N-instance bug, and the comment at the top of scheduler/index.ts already
    // names it — with N instances each tick fires N times.
    const timers = FILES.filter((f) => /\bsetInterval\b/.test(f.code)).map((f) => f.relative)

    // Not an exhaustive allow-list of every future timer: it is the set the
    // repo actually has, asserted so a NEW timer has to be classified rather
    // than added quietly. Each entry is justified in OWN_RUNTIME's comment.
    const unclassified = timers.filter((t) => !TIMER_CONSUMERS.has(t) && !t.startsWith(TEST_DIR))
    expect(unclassified).toEqual([])

    // And the two that do periodic real work must actually claim.
    for (const poller of ['plugins/job-scheduler.plugin.ts', 'scheduler/index.ts']) {
      const file = FILES.find((f) => f.relative === poller)
      expect(file, poller).toBeDefined()
      expect(file?.code, poller).toMatch(/claim_jobs|claimJobs|runScheduledOnce/)
    }
  })

  it('the two in-process queues are gone, not merely unused', () => {
    // ⚠️ "Zero callers" was true of both of these for months and neither was
    // removed, because nothing asserted their removal. An unused parallel
    // runtime is a trap: the next capability reaches for the one that looks
    // simplest, and it is the one that loses work on restart.
    const dead = ['queue.ts', 'queue/pdf-queue.ts'].filter((rel) =>
      FILES.some((f) => f.relative === rel),
    )

    expect(dead).toEqual([])
  })

  it('the surviving runtime still holds the guarantees it claims', () => {
    // A guard that only forbids new queues would still pass if the surviving
    // one were gutted. These are the properties the rest of the system trusts.
    // The names are the ones the code actually calls — `finish_scheduled_run`,
    // not `complete_scheduled_run`. Writing the name I expected instead of the
    // one in the source is how a guard ends up asserting a function that has
    // never existed.
    const distributed = FILES.find((f) => f.relative === 'services/distributed-work.ts')
    expect(distributed).toBeDefined()
    expect(distributed?.code).toMatch(/claim_background_jobs/)
    expect(distributed?.code).toMatch(/claim_scheduled_run/)
    expect(distributed?.code).toMatch(/finish_scheduled_run/)
    // A claim is only safe if finishing it is conditional on still holding it.
    // Without that, a slow worker's late completion wipes a slot another
    // instance has already taken.
    expect(distributed?.code).toMatch(/complete_background_job/)

    // The email outbox is the second authority because durability is a different
    // requirement: a password-reset token must not sit in a process that can
    // die. It still writes the row BEFORE it claims it.
    const outbox = FILES.find((f) => f.relative === 'services/email-outbox.ts')
    expect(outbox).toBeDefined()
    expect(outbox?.code).toMatch(/claim_email_outbox/)
  })
})
