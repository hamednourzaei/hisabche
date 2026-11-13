// The deploy build (Render, `render-build.sh`) must not depend on a file the repository no
// longer has. 12 Nov 2026: `drizzle-kit generate` ran there against
// `backend/src/drizzle-schema.ts`, which V61 removed as dead code (zero imports), and every
// backend deploy failed with «No schema files found» while every test stayed green.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(__dirname, '..', '..', '..')
const steps = readFileSync(join(repo, 'render-build.sh'), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'))
  .join('\n')

describe('render-build.sh', () => {
  it('does not generate migrations: the schema is docs/*-migration.sql, run by a person', () => {
    expect(steps).not.toContain('drizzle-kit')
  })

  it('installs the workspace from the lockfile, and the start needs no compile step', () => {
    expect(steps).toContain('install --frozen-lockfile')
    expect(readFileSync(join(repo, 'render-start.sh'), 'utf8')).toContain('tsx src/index.ts')
    expect(existsSync(join(repo, 'backend', 'src', 'index.ts'))).toBe(true)
  })
})
