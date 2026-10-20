import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Guard test: Law 0.2 of Admin Contract:
 * "shadcn/ui only, from one place.
 * Every component comes from @hisabche/ui (re-exported by apps/admin/components/ui/index.ts).
 * A primitive that does not exist yet is added once to packages/ui with the standard shadcn source,
 * tokens only, RTL logical classes — never inside apps/admin, never a hand-drawn look-alike."
 *
 * This test fails if apps/admin defines its own button, table, card, dialog, select, or pagination.
 */
describe('No duplicated primitives in apps/admin (guard)', () => {
  const adminRoot = path.resolve(__dirname, '../../')

  it('admin-ui.tsx does not contain hand-made Panel, FilterPill, Pagination, ListSkeleton, EmptyState, or StatusDot', () => {
    const adminUiPath = path.join(adminRoot, 'components/admin-shell/admin-ui.tsx')
    const content = fs.readFileSync(adminUiPath, 'utf-8')

    expect(content).not.toContain('export function Panel')
    expect(content).not.toContain('export function FilterPill')
    expect(content).not.toContain('export function Pagination')
    expect(content).not.toContain('export function ListSkeleton')
    expect(content).not.toContain('export function EmptyState')
    expect(content).not.toContain('export function StatusDot')
    expect(content).toContain('export function ErrorState')
  })

  it('components/ui/index.ts only re-exports from @hisabche/ui without defining local components', () => {
    const uiIndexPath = path.join(adminRoot, 'components/ui/index.ts')
    const content = fs.readFileSync(uiIndexPath, 'utf-8')

    expect(content).toContain("from '@hisabche/ui'")
    expect(content).not.toContain('function Button')
    expect(content).not.toContain('function Table')
    expect(content).not.toContain('function Card')
    expect(content).not.toContain('function Dialog')
    expect(content).not.toContain('function Select')
    expect(content).not.toContain('function Pagination')
  })

  it('no file in apps/admin defines a local implementation of standard shadcn primitives', () => {
    const bannedDefinitions = [
      'function Button(',
      'const Button =',
      'function Table(',
      'const Table =',
      'function Card(',
      'const Card =',
      'function Dialog(',
      'const Dialog =',
      'function Select(',
      'const Select =',
      'function Pagination(',
      'const Pagination =',
    ]

    function scanDir(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const files: string[] = []
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (
            entry.name === 'node_modules' ||
            entry.name === '.next' ||
            entry.name === '__tests__'
          ) {
            continue
          }
          files.push(...scanDir(fullPath))
        } else if (
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.endsWith('.d.ts')
        ) {
          files.push(fullPath)
        }
      }
      return files
    }

    const allFiles = scanDir(adminRoot)
    const violations: { file: string; banned: string }[] = []

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      for (const banned of bannedDefinitions) {
        if (content.includes(`export ${banned}`) || content.includes(banned)) {
          // Allow comments or mentions in strings/identifiers (e.g. ButtonVariant, TableCell, SelectItem)
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!.trim()
            if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue
            if (line.includes(`export ${banned}`) || line.startsWith(banned)) {
              violations.push({
                file: path.relative(adminRoot, file),
                banned: line,
              })
            }
          }
        }
      }
    }

    expect(violations).toEqual([])
  })
})
