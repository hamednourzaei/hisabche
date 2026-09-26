// ============================================
// A build approval for one platform is an approval for every platform.
//
// pnpm installs only the variant of a platform package that matches the
// machine, and fails the whole install on a build script nobody decided about
// (ERR_PNPM_IGNORED_BUILDS). `@embedded-postgres/windows-x64` was approved on
// the Windows machine it was added on; Vercel builds on Linux, installed
// `@embedded-postgres/linux-x64`, and the deploy stopped at `pnpm install`.
//
// Rule: if any platform variant of a package is listed in allowBuilds, every
// variant of it in the lockfile must be listed too (true or false — decided).
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..')
const workspace = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8')
const lockfile = readFileSync(join(ROOT, 'pnpm-lock.yaml'), 'utf8')

const PLATFORM_SUFFIX =
  /[-/](darwin|linux|win32|windows|freebsd|openbsd|sunos|android)(-[a-z0-9]+)*$/

/** Package names in the `allowBuilds:` block, version stripped. */
function approvedNames(): Set<string> {
  const block = /^allowBuilds:\n((?:[ \t]+.*\n|[ \t]*\n)*)/m.exec(workspace.replace(/\r\n/g, '\n'))
  if (!block) throw new Error('no allowBuilds block in pnpm-workspace.yaml')
  const names = new Set<string>()
  for (const line of block[1]!.split('\n')) {
    const m = /^\s+'?((?:@[^/'\s]+\/)?[^@'\s:]+)(?:@[^'\s:]+)?'?:/.exec(line)
    if (m) names.add(m[1]!)
  }
  return names
}

/** Every package name in the lockfile's `packages:` section. */
function lockedNames(): Set<string> {
  const names = new Set<string>()
  for (const m of lockfile.matchAll(/^ {2}'?((?:@[^/'\s]+\/)?[^@'\s:]+)@[^'\s:]+'?:/gm))
    names.add(m[1]!)
  return names
}

const familyOf = (name: string) => name.replace(PLATFORM_SUFFIX, '')

describe('pnpm build approvals cover every platform', () => {
  const approved = approvedNames()
  const locked = lockedNames()

  it('reads both files', () => {
    expect(approved.has('@embedded-postgres/windows-x64')).toBe(true)
    expect(locked.has('@embedded-postgres/linux-x64')).toBe(true)
  })

  const families = [...approved].filter((name) => familyOf(name) !== name).map(familyOf)

  it.each([...new Set(families)])('every platform variant of %s is decided', (family) => {
    const variants = [...locked].filter((name) => familyOf(name) === family && name !== family)
    const undecided = variants.filter((name) => !approved.has(name))
    expect(
      undecided,
      `add these to allowBuilds in pnpm-workspace.yaml: ${undecided.join(', ')}`,
    ).toEqual([])
  })
})
