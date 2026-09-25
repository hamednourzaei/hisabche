// ============================================
// ⚠️ EVERY SIGNED-IN SHELL LOADS THE WORKSPACE.
//
// `fetchWorkspace` had one caller — the workspace settings page — so unless
// someone opened that page, `workspaceId` was null everywhere. Nothing failed:
// realtime subscribed to nothing (it returns early without a workspace), the
// desktop/mobile sync engine ran with a null workspace, and the device query
// cache had no owner to be saved under (راهنمای سشن §۷٫۱ — a rule nobody calls).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(__dirname, '..', '..', '..', '..')
const code = (path: string) =>
  readFileSync(join(repo, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

describe('the workspace is loaded as soon as someone is signed in', () => {
  it.each([
    ['desktop + mobile shell', 'packages/app-shell/src/app/providers.tsx'],
    ['web dashboard', 'apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx'],
  ])('%s', (_host, file) => {
    const source = code(file)
    expect(source).toContain('useWorkspaceStore((s) => s.fetchWorkspace)')
    expect(source).toMatch(/if \([^)]*userId\) void fetchWorkspace\(userId\)/)
  })
})
