import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('8.2 / W3 Salon Permission Boundaries', () => {
  const routesSrc = readFileSync(path.resolve(__dirname, '../routes/salon.routes.ts'), 'utf8')

  it('enforces payroll.write on commission rate changes and payroll.read on team commission report', () => {
    expect(routesSrc).toContain("'/api/provider-commissions/rates'")
    expect(routesSrc).toContain("requireCapability('payroll.write')")
    expect(routesSrc).toContain("requireCapability('payroll.read')")
    // Stylist self-read is separate (scoped by ctx.userId) under read capability
    expect(routesSrc).toContain("'/api/provider-commissions/my'")
  })
})
