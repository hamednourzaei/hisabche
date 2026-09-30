// ============================================
// Capabilities that are WRITTEN but not WIRED.
//
// ⚠️ WHAT THIS IS FOR.
//
// The most expensive defect class in this codebase is not a crash. It is an
// abstraction that is correct, fully tested, and called by nobody — because no
// test can see the absence of a caller, so it survives for years looking like
// a finished feature. Seven times in one session, `lesson 84`:
//
//   general-ledger · useRecordHistory · stock-count.domain
//   transfer.domain · branchIds · useRoleMembers · ApprovalCard
//
// The correct code, undiscoverable, is the worst state to be in: nobody uses it
// and nobody removes it, and the next phase builds the same thing again — a
// parallel model, which G2 forbids.
//
// So this file NAMES that state instead of leaving it implied. Each entry below
// is a real finding from Phase 0 of the Business OS, with the evidence that
// makes it true, and a status that can only be one of two honest values:
//
//   WIRED              — a production call site exists
//   WRITTEN_NOT_WIRED  — the logic and its tests exist, nothing calls it
//
// ⚠️ AND WHY THE ENTRY IS NOT SIMPLY DELETED.
//
// §14 says drop code you misunderstood. That is right for code that was
// WRONG. This code is correct, and the owner decided on 30 September 2026 to
// keep it: `shouldEscalate` and `escalatedRole` are the arithmetic for
// capability #68 (Escalation Rules) out of the 150. Deleting correct logic for
// a feature that is two phases away would make Phase 5 rebuild it from nothing.
//
// So it stays, honestly labelled, and the moment it is wired this guard turns
// red and the label is updated. That is the whole point: the entry has to be
// DELETED to go green, so "we wired it" cannot be forgotten.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

/**
 * Line comments BEFORE block comments: a path or glob inside a line comment
 * opens a fake block comment that swallows the rest of the file (BUG-029).
 */
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

type Status = 'WIRED' | 'WRITTEN_NOT_WIRED'

interface Capability {
  /** The capability number from the 150-item map, for traceability. */
  id: string
  /** Where the logic lives. */
  file: string
  /** The exported symbols that exist but have no production caller. */
  symbols: string[]
  /**
   * Why it is not wired, in one sentence the next reader can act on. This is
   * the field that stops the entry decaying into a bare function list.
   */
  note: string
  status: Status
}

/**
 * The register.
 *
 * ⚠️ Every entry must be TRUE when this file is read, and provable by the test
 * below — a register that can hold a lie is worse than no register.
 */
const REGISTER: Capability[] = [
  {
    // A second class of entry, and the reason the register has a `WIRED` status
    // at all. `monthEndsFiscalYear` and the cost repost were both on this list
    // during Phase 1, and escalation during Phase 5. All three were wired
    // before their phase ended. Keeping the row with its status flipped records
    // that the decision was taken rather than that the entry was forgotten — a
    // register that only ever holds failures cannot show that anything was
    // finished.
    id: '#68 Escalation Rules (WIRED)',
    file: 'services/workflow/escalation.domain.ts',
    symbols: ['decideEscalation', 'compensationFor'],
    note:
      'Wired on 30 September 2026 as capability #68. The arithmetic had existed ' +
      'since the approval work and was called by nothing; the new module replaced ' +
      '`shouldEscalate`/`escalatedRole` because those never checked whether the ' +
      'target role held anybody — they returned a role name for a workspace that ' +
      'had none, so a document escalated into an empty room. `decideEscalation` ' +
      'reports NO_ONE_TO_ESCALATE_TO instead. `compensationFor` is capability #81 ' +
      'and is registered here only because it shares the file.',
    status: 'WIRED',
  },
  {
    id: '#69 Month-End · fiscal year end (WIRED, setting still missing)',
    file: 'services/accounting/month-end.domain.ts',
    symbols: ['monthEndsFiscalYear'],
    note:
      'Wired on 2026-09-30: the month-end service calls it. The rule still takes ' +
      'the year end as a PARAMETER because no workspace setting exists, so the ' +
      'route requires the caller to send it — a deliberate cost, to avoid ' +
      'defaulting to December and closing a year on the wrong day for any shop ' +
      'whose books end in March. Follow-up: a settings table, then drop the ' +
      'parameter.',
    status: 'WIRED',
  },
]

describe('the register of written-but-unwired capabilities is honest', () => {
  it('inspects the backend, not an empty list', () => {
    expect(FILES.length).toBeGreaterThan(50)
  })

  it('every file the register names exists', () => {
    for (const cap of REGISTER) {
      expect(
        FILES.some((f) => f.relative === cap.file),
        `${cap.id} names a file that does not exist: ${cap.file}`,
      ).toBe(true)
    }
  })

  it('every symbol the register names is really exported', () => {
    for (const cap of REGISTER) {
      const file = FILES.find((f) => f.relative === cap.file)
      for (const symbol of cap.symbols) {
        expect(file?.code, `${cap.id}: ${symbol} is not exported by ${cap.file}`).toMatch(
          new RegExp(`export (?:function|const|async function) ${symbol}\\b`),
        )
      }
    }
  })

  it('every WRITTEN_NOT_WIRED entry still has no production caller', () => {
    // ⚠️ This is the assertion that keeps the register from rotting. When
    // Phase 5 wires escalation, this goes red, and the fix is to change the
    // status to WIRED — not to relax the check.
    for (const cap of REGISTER.filter((c) => c.status === 'WRITTEN_NOT_WIRED')) {
      for (const symbol of cap.symbols) {
        // A "caller" is a mention outside the declaring file and outside tests.
        const callers = FILES.filter(
          (f) =>
            f.relative !== cap.file &&
            !f.relative.startsWith('__tests__/') &&
            new RegExp(`\\b${symbol}\\b`).test(f.code),
        ).map((f) => f.relative)

        expect(
          callers,
          `${cap.id}: ${symbol} now has a caller (${callers.join(', ')}) — ` +
            `it is wired, so its status must change to WIRED and this entry removed.`,
        ).toEqual([])
      }
    }
  })

  it('every WIRED entry really does have a caller', () => {
    // ⚠️ The mirror of the test above, and without it the register is a
    // one-way ratchet: any symbol can be relabelled WIRED and go quiet, and a
    // capability that silently lost its last call site would be recorded as
    // finished rather than as lost.
    for (const cap of REGISTER.filter((c) => c.status === 'WIRED')) {
      for (const symbol of cap.symbols) {
        const callers = FILES.filter(
          (f) =>
            f.relative !== cap.file &&
            !f.relative.startsWith('__tests__/') &&
            new RegExp(`\\b${symbol}\\b`).test(f.code),
        ).map((f) => f.relative)

        expect(
          callers.length,
          `${cap.id}: ${symbol} is marked WIRED but nothing calls it any more. ` +
            'Either it lost its caller — change the status back to WRITTEN_NOT_WIRED — ' +
            'or it was never wired and the status was a guess.',
        ).toBeGreaterThan(0)
      }
    }
  })

  it('the register is not allowed to grow silently', () => {
    // A register that accepts new rows without thought becomes a graveyard.
    // Two is the honest count after Phase 1: escalation (unwired) and the
    // fiscal year end (wired). Cost repost was on this list until its service
    // was written on 30 September 2026, and its removal is exactly what this
    // guard is for.
    expect(REGISTER.length).toBeLessThanOrEqual(2)
  })
})
