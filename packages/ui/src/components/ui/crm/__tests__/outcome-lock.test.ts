// Request #98-د — a recorded call result is a record, not a toggle.
//
// «اون تیک سبز و قرمز هنوز هستن و حتی با کامل کردن تسک باز امکان تغییر دادنش
// هست و این اشتباهه». Two locks: a row that already has an outcome, and a task
// that is finished.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
// Comments describe the bug; asserting on them would pass for the wrong reason.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('recorded outcomes cannot be rewritten', () => {
  const src = code(read('task-customer-outcomes.tsx'))

  it('a row that already answered shows no buttons', () => {
    const actions = src.slice(src.indexOf("id: 'actions'"))
    expect(actions).toContain('if (row.outcome) return null')
  })

  it('a finished task loses the whole actions column', () => {
    expect(src).toContain('onRecord && !isLocked')
  })

  it('the lock is part of the memo deps — otherwise the column survives', () => {
    const deps = src.slice(src.indexOf('[t, locale, onRecord'))
    expect(deps.slice(0, 120)).toContain('isLocked')
  })
})

describe('both call sites pass the lock', () => {
  it.each([
    ['task-detail-modal.tsx', 'task'],
    ['containers/public-task-container.tsx', 'data'],
  ])('%s locks on completed', (file, prop) => {
    const src = code(read(file))
    expect(src).toContain(`isLocked={${prop}.status === 'completed'}`)
  })
})
