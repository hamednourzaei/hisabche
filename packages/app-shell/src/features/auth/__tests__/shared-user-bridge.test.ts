// ============================================
// The device shell hands the signed-in person to the shared UI.
//
// Windows/Android keep the session in the shell's own auth store; screens in
// packages/ui (the dashboard's personal view, the wrench, 11 files) read the
// person from `@hisabche/store`. Without the bridge that store's `user` stays
// null on the device: `usePageLook` is never ready, every dashboard part is
// disabled, and the dashboard shows loading cards forever while every other
// page loads (20 Oct 2026).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (...parts: string[]) =>
  readFileSync(join(__dirname, ...parts), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')

describe('the shell mirrors the signed-in person into @hisabche/store', () => {
  const store = read('..', 'auth.store.ts')

  it('imports the shared auth store', () => {
    expect(store).toContain(
      "import { useAuthStore as useSharedAuthStore, useWorkspaceStore } from '@hisabche/store'",
    )
  })

  it('mirrors on start and on every change, the person only (never the token)', () => {
    expect(store).toContain('mirrorSignedInUser(useAuthStore.getState().session?.user ?? null)')
    expect(store).toContain(
      'useAuthStore.subscribe((state) => mirrorSignedInUser(state.session?.user ?? null))',
    )
    expect(store).toContain('useSharedAuthStore.setState({ user })')
    expect(store).not.toMatch(/useSharedAuthStore\.setState\(\{[^}]*token/)
  })

  it('the personal view still reads the person from @hisabche/store', () => {
    const look = read('..', '..', '..', '..', '..', 'ui', 'src', 'lib', 'page-look.ts')
    expect(look).toContain("import { useAuthStore, useWorkspaceStore } from '@hisabche/store'")
  })
})
