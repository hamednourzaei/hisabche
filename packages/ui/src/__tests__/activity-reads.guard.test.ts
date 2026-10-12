// ============================================
// packages/ui/src/__tests__/activity-reads.guard.test.ts
//
// Guards for Activity Read Tracking and Badge Unification:
// - Row open action calls mark mutation; no mark in scroll/render effects; useMarkAsRead has caller
// - No `> 99` or `99+` anywhere in packages/ui or packages/app-shell
// - Every unified badge file imports formatCompactCount
// - i18n keys complete in fa, af, en and deprecated keys removed
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Source with comments stripped and whitespace flattened */
function code(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
}

function findSourceFiles(dir: string): string[] {
  let files: string[] = []
  for (const item of readdirSync(dir)) {
    if (item === 'node_modules' || item === '.next' || item === 'dist') continue
    const full = join(dir, item)
    if (statSync(full).isDirectory()) {
      files = files.concat(findSourceFiles(full))
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(full)
    }
  }
  return files
}

describe('Guard: Activity Read Tracking on UI', () => {
  const activitiesPage = code(
    read('packages', 'ui', 'src', 'components', 'ui', 'activity', 'ActivitiesPage.tsx'),
  )

  it('useMarkAsRead is imported and wired to user open action', () => {
    expect(activitiesPage).toContain('useMarkActivityAsRead')
    expect(activitiesPage).toContain('markAsRead')
    // Called inside handleActivityClick
    expect(activitiesPage).toMatch(/handleActivityClick.*markAsRead/)
  })

  it('never marks activities in scroll, mount, or render effects', () => {
    // There should be no useEffect calling markAsRead or markAllAsRead
    expect(activitiesPage).not.toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[^}]*markAsRead/)
    expect(activitiesPage).not.toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[^}]*markAllAsRead/)
  })

  it('mark-all respects current active tab filter', () => {
    expect(activitiesPage).toContain(
      "markAllAsRead(filter === 'all' || filter === 'unread' ? undefined : filter)",
    )
  })
})

describe('Guard: Badge Unification', () => {
  const badgeFiles = [
    join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'notification-bell.tsx'),
    join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'dashboard-sidebar.tsx'),
    join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'dashboard', 'dashboard-stats.tsx'),
    join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'state', 'work-state.tsx'),
    join(ROOT, 'packages', 'ui', 'src', 'components', 'ui', 'work-queue', 'work-queue-panel.tsx'),
  ]

  it('every badge component imports formatCompactCount', () => {
    for (const file of badgeFiles) {
      const content = readFileSync(file, 'utf8')
      expect(content, `File ${file} must import formatCompactCount`).toContain('formatCompactCount')
    }
  })

  it('no > 99 or 99+ or ۹۹+ remains in packages/ui and packages/app-shell', () => {
    const allFiles = [
      ...findSourceFiles(join(ROOT, 'packages', 'ui', 'src')),
      ...findSourceFiles(join(ROOT, 'packages', 'app-shell', 'src')),
    ]

    for (const file of allFiles) {
      // Exclude this guard test itself
      if (file.includes('activity-reads.guard.test.ts')) continue
      const content = readFileSync(file, 'utf8')
      expect(content, `File ${file} contains > 99`).not.toContain('> 99')
      expect(content, `File ${file} contains 99+`).not.toContain('99+')
      expect(content, `File ${file} contains ۹۹+`).not.toContain('۹۹+')
    }
  })
})

describe('Guard: i18n completeness for badges and activities', () => {
  const locales = ['fa', 'af', 'en'] as const

  for (const lang of locales) {
    it(`${lang} has all required activity and badge keys, and no deprecated keys`, () => {
      const messages = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))

      expect(messages.notifications?.unreadCountBadge).toBeDefined()
      expect(typeof messages.notifications.unreadCountBadge).toBe('string')
      expect(messages.notifications.unreadCountBadge).toContain('{count}')

      expect(messages.activity?.newCountBadge).toBeDefined()
      expect(typeof messages.activity.newCountBadge).toBe('string')
      expect(messages.activity.newCountBadge).toContain('{count}')

      // notifications.many must be gone
      expect(messages.notifications?.many).toBeUndefined()
    })
  }
})
