// ============================================
// «پرداخت شد / پرداخت نشد» on a salary.
//
// What can go wrong: the route having no caller again (the owner saw «پیش‌نویس»
// and no button); a paid salary offered a button that un-pays it while its
// journal entry stays; «not paid» saved with no reason; the rule checked in a
// read before the write, so two people can both pass; a salary recorded as paid
// never reaching the books; the list hiding the reason; two screens drawing the
// control twice.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPayrollFinal } from '@hisabche/validation'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const control = ui('team-and-payroll', 'payroll-outcome.tsx')
const service = code(read('backend', 'src', 'services', 'human-resources.service.ts'))
const settle = service.slice(
  service.indexOf('async updatePayrollStatus('),
  service.indexOf('private async bookPayroll('),
)

describe('one rule: a paid salary is final', () => {
  it('only «paid» is final', () => {
    expect(isPayrollFinal('paid')).toBe(true)
    for (const status of ['draft', 'approved', 'cancelled', '', null, undefined]) {
      expect(isPayrollFinal(status)).toBe(false)
    }
  })

  it('the screen offers no button on it', () => {
    expect(control).toContain('const isPaid = isPayrollFinal(status)')
    expect(control).toContain('{isPaid ? null : (')
  })

  it('the server refuses it in the WHERE clause, not in a read before the write', () => {
    expect(settle).toContain(".or('status.is.null,status.neq.paid')")
    // Flattened: the formatter wraps the long message onto its own line.
    expect(settle.split(/\s+/).join(' ')).toContain(
      "throw new ConflictError( 'PAYROLL_ALREADY_PAID",
    )
    expect(settle.indexOf('.update(updates)')).toBeLessThan(settle.indexOf(".select('id, status')"))
  })
})

describe('«پرداخت نشد» says why', () => {
  it('the server requires the reason', () => {
    expect(settle).toContain("if (data.status === 'cancelled' && reason === '')")
    expect(settle).toContain("throw new ValidationError('PAYROLL_REASON_REQUIRED")
    expect(settle).toContain('if (data.notes !== undefined) updates.notes = reason || null')
  })

  it('the dialog refuses an empty one before asking the server', () => {
    expect(control).toContain("if (asking === 'notPaid' && reason.trim() === '')")
    expect(control).toContain("status: 'cancelled', notes: reason.trim()")
  })

  it('the list reads the reason — it was not in the columns the list selects', () => {
    expect(service).toContain('status, payment_date, currency, notes')
    expect(control).toContain('{isNotPaid && row.notes ? (')
  })

  it('a refusal reaches the person as its status, not as a 500', () => {
    const routes = code(read('backend', 'src', 'routes', 'human-resources.routes.ts'))
    expect(routes).toContain(
      "return sendFailure(reply, fastify.log, err, 'Failed to update payroll')",
    )
    expect(control).toContain("message.startsWith('PAYROLL_ALREADY_PAID')")
  })
})

describe('a paid salary reaches the books, whichever way it became paid', () => {
  it('marked paid later', () => {
    expect(settle).toContain("if (data.status === 'paid') {")
    expect(settle).toContain('await this.bookPayroll(ctx, payroll as Record<string, unknown>)')
  })

  it('recorded as paid from the start', () => {
    const create = service.slice(
      service.indexOf('async createPayroll('),
      service.indexOf('async updatePayrollStatus('),
    )
    expect(create).toContain("if (data.status === 'paid') {")
    expect(create).toContain('await this.bookPayroll(ctx, payroll as Record<string, unknown>)')
  })

  it('paid with no date means paid now', () => {
    expect(settle).toContain(
      "else if (data.status === 'paid') updates.payment_date = new Date().toISOString()",
    )
  })
})

describe('a leave request can be decided — once', () => {
  const panel = ui('human-resources', 'employee-leave-panel.tsx')
  const decide = service.slice(
    service.indexOf('async updateLeaveStatus('),
    service.indexOf('private async invalidatePayrollCache('),
  )

  it('the route that had no caller has one', () => {
    const hook = code(read('packages', 'api', 'src', 'hooks', 'leaves.ts'))
    expect(hook).toContain('apiClient.patch(`/leaves/${input.id}`, input)')
    expect(panel).toContain('useDecideLeave()')
    expect(panel).toContain('<LeaveDecision t={t} leave={leave} />')
  })

  it('only a waiting request shows the two buttons', () => {
    expect(panel).toContain("{leave.status === 'pending' ? (")
    expect(panel).toContain("onClick={() => void run('approved')}")
    expect(panel).toContain("onClick={() => void run('rejected')}")
  })

  it('the server decides it once, in the WHERE clause', () => {
    expect(decide.length).toBeGreaterThan(200)
    expect(decide).toContain("if (data.status !== undefined) write = write.eq('status', 'pending')")
    expect(decide).toContain("throw new ConflictError('LEAVE_ALREADY_DECIDED")
  })

  it('every word exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json')).hr
      for (const key of [
        'leaveApprove',
        'leaveReject',
        'leaveDecideError',
        'leaveAlreadyDecided',
      ]) {
        expect(words[key], `${lang} ${key}`).toEqual(expect.any(String))
      }
    }
  })
})

describe('one control, on both screens, with a caller for the route', () => {
  it('the hook calls the route that had none', () => {
    const hook = code(read('packages', 'api', 'src', 'hooks', 'payroll.ts'))
    expect(hook).toContain('apiClient.patch(`/payrolls/${values.id}`, values)')
    expect(hook).toContain('qc.invalidateQueries({ queryKey: payrollKeys.all })')
    expect(control).toContain('useSettlePayroll()')
  })

  it('the payroll list and the employee page mount the same control', () => {
    expect(ui('team-and-payroll', 'payroll-list-table.tsx')).toContain(
      '<PayrollOutcome t={t} row={row} />',
    )
    expect(ui('human-resources', 'employee-detail-view.tsx')).toContain(
      '<PayrollOutcome t={t} row={p} />',
    )
  })

  it('a click on it does not open the employee behind the row', () => {
    expect(control).toContain('onClick={(event) => event.stopPropagation()}')
  })

  it('every word exists in all three languages', () => {
    const keys = [...new Set([...control.matchAll(/t\(\s*'hr\.outcome\.(\w+)'/g)].map((m) => m[1]))]
    expect(keys.length).toBeGreaterThan(12)
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json')).hr.outcome
      for (const key of keys)
        expect(words[key as string], `${lang} ${key}`).toEqual(expect.any(String))
    }
  })
})
