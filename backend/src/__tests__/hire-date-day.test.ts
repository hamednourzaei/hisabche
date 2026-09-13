import { describe, it, expect } from 'vitest'
import { createEmployeeSchema } from '@hisabche/validation'
describe('hireDate', () => {
  it('accepts a day and a datetime, rejects junk', () => {
    const base = { firstName: 'a', lastName: 'b' } as Record<string, unknown>
    const ok = (v: string) =>
      createEmployeeSchema
        .safeParse({ ...base, hireDate: v })
        .error?.issues.find((i) => i.path[0] === 'hireDate')
    expect(ok('2026-09-13')).toBeUndefined()
    expect(ok('2026-09-13T00:00:00.000Z')).toBeUndefined()
    expect(ok('13/09/2026')).toBeDefined()
  })
})
