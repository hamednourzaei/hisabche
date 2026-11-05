// packages/ui/src/__tests__/onboarding-bootstrap-guard.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(__dirname, '..', '..', '..', '..')
const code = (path: string) =>
  readFileSync(join(repo, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('Onboarding bootstrap render guard', () => {
  it('dashboard-layout imports isOnboardingRoute from @hisabche/ui-contract', () => {
    const layout = code('apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx')
    expect(layout).toContain('isOnboardingRoute')
    expect(layout).toMatch(
      /import\s*\{[^}]*isOnboardingRoute[^}]*\}\s*from\s*['"]@hisabche\/ui-contract['"]/,
    )
  })

  it('dashboard-layout exempts isOnboardingRoute from the no-workspace blocking screen', () => {
    const layout = code('apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx')
    // Asserts that !workspaceId && hasNoWorkspace is guarded with !isOnboardingRoute(pathname)
    expect(layout).toContain('!workspaceId && hasNoWorkspace && !isOnboardingRoute(pathname)')
  })

  it('protected routes still mount the no-workspace blocking screen', () => {
    const layout = code('apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx')
    expect(layout).toContain('در حال آماده‌سازی فضای کاری شما...')
  })
})
