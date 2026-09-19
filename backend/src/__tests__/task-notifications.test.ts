// Request #98-ج — a task tells people about itself.
//
// «زمانی که این وظیفه جدید ثبت شد، برای هر کارمند به اون کارمند نوتیفیکیشن بره
// که تسک جدید داره؛ با هر تغییر … به مالک نوتیف بره».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
// Comments explain the bug being prevented; a `not.toContain` must not match them.
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const service = code(src('services/crm/crm.service.ts'))

describe('a new task reaches the employee', () => {
  const create = service.slice(
    service.indexOf('async createInteraction('),
    service.indexOf('async updateInteractionStatus('),
  )

  it('notifies only after the row exists', () => {
    expect(create).toContain('await this.notifyEmployee(')
    expect(create.indexOf('insertInteraction')).toBeLessThan(create.indexOf('notifyEmployee'))
  })

  it('says nothing when no employee was assigned', () => {
    expect(create).toContain('if (data.employeeId) {')
  })
})

describe('a status change reaches the other side', () => {
  const change = service.slice(service.indexOf('private async changeStatus('))

  it('the employee’s change goes to the owner', () => {
    expect(change).toContain("if (changedBy === 'employee')")
    expect(change).toContain('const ownerId = task.user_id')
  })

  it('the owner’s change goes to the employee', () => {
    expect(change).toContain('const employeeId = task.employee_id')
  })

  it('reads the columns it needs — a missing one is a silent no-notification', () => {
    expect(change).toContain("'status_history, user_id, employee_id, subject, status'")
  })

  it('fires AFTER the write is saved and the cache cleared', () => {
    const body = change.slice(0, change.indexOf('private async notifyEmployee'))
    expect(body.indexOf('await this.invalidate(')).toBeLessThan(
      body.indexOf('await this.notifyStatusChange('),
    )
  })
})

describe('a notification can never undo the change', () => {
  it('every send is wrapped — a failed insert is logged, not thrown', () => {
    const helpers = service.slice(service.indexOf('private async notifyEmployee'))
    expect(helpers).toContain('catch (error)')
    expect(helpers).toContain("console.error('[CrmService] task notification failed:'")
  })

  it('an employee with no account is skipped, never invented', () => {
    // §12 — a notification lands in a real person's inbox. Nobody linked
    // means nobody notified, not «pick the owner instead».
    expect(service).toContain('if (!userId) return')
    const repo = code(src('services/crm/crm.repository.ts'))
    const lookup = repo.slice(repo.indexOf('async employeeAccount('))
    expect(lookup.slice(0, 700)).toContain(".eq('workspace_id', workspaceId)")
    expect(lookup.slice(0, 700)).toContain('userId: row?.user_id ?? null')
  })
})
