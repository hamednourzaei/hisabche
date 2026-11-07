// ============================================
// Settings → «صفحه‌ها و تب‌ها» (7 Nov 2026): the person adds or removes pages
// and tabs for themselves, on top of what Hisabche set up.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PAGES_WITH_TABS } from '../components/ui/settings/pages-and-tabs-settings'
import { consumeCustomizeFlag, customizeHref } from '../lib/customize-flag'

const UI = join(__dirname, '..', 'components', 'ui')
const read = (rel: string) => readFileSync(join(UI, rel), 'utf8')
const MESSAGES = join(__dirname, '..', '..', '..', 'i18n', 'messages')

/** Each page listed in settings → the hub that registers its tabs. */
const HUB_OF: Record<string, { file: string; look: string }> = {
  '/invoices': {
    file: 'invoices/containers/sales-hub-container.tsx',
    look: "usePageLook('hub:invoices')",
  },
  '/customers': {
    file: 'customers/containers/customers-hub-container.tsx',
    look: "usePageLook('hub:customers')",
  },
  '/warehouse': {
    file: 'warehouse/containers/warehouse-tabs-container.tsx',
    look: "usePageLook('hub:warehouse')",
  },
  '/accounting': { file: 'accounting/AccountingPage.tsx', look: 'lookId="accounting"' },
  '/approvals': {
    file: 'workflow/containers/approvals-hub-container.tsx',
    look: "usePageLook('hub:approvals')",
  },
  '/billing': { file: 'billing/containers/billing-hub-container.tsx', look: 'lookId="billing"' },
  '/data-and-sync': {
    file: 'data-and-sync/containers/data-hub-container.tsx',
    look: 'lookId="data"',
  },
}

describe('every page offered for tab choice really has customizable tabs', () => {
  it('the list and the hubs agree', () => {
    expect([...PAGES_WITH_TABS].sort()).toEqual(Object.keys(HUB_OF).sort())
  })

  it.each(Object.entries(HUB_OF))('%s registers its tabs', (_path, hub) => {
    expect(read(hub.file)).toContain(hub.look)
  })
})

describe('the settings page carries the section, on every host', () => {
  it('the shared SettingsPage mounts it (the desktop/mobile shell renders the same page)', () => {
    expect(read('settings/settings-page.tsx')).toContain('<PagesAndTabsSettings />')
    const shell = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        'app-shell',
        'src',
        'features',
        'settings',
        'settings-page.tsx',
      ),
      'utf8',
    )
    expect(shell).toContain('<SharedSettingsPage')
  })

  it('reuses the one menu group and the one dialog — no second customizer', () => {
    const section = read('settings/pages-and-tabs-settings.tsx')
    expect(section).toContain('useMenuCustomizerGroup(ct)')
    expect(section).toContain('<PageCustomizer')
    expect(read('global-page-customizer.tsx')).toContain('useMenuCustomizerGroup(t)')
  })
})

describe('?customize=1 opens the wrench once, then leaves the address', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('builds the link', () => {
    expect(customizeHref('/warehouse')).toBe('/warehouse?customize=1')
  })

  it('web address: read once, removed, other parameters kept', () => {
    window.history.replaceState(null, '', '/fa/warehouse?view=products&customize=1')
    expect(consumeCustomizeFlag()).toBe(true)
    expect(window.location.search).toBe('?view=products')
    // The second customizer on the same page finds nothing.
    expect(consumeCustomizeFlag()).toBe(false)
  })

  it('hash router (desktop, mobile): read once, removed', () => {
    window.history.replaceState(null, '', '/index.html#/warehouse?customize=1')
    expect(consumeCustomizeFlag()).toBe(true)
    expect(window.location.hash).toBe('#/warehouse')
    expect(consumeCustomizeFlag()).toBe(false)
  })

  it('no flag, no dialog', () => {
    window.history.replaceState(null, '', '/fa/warehouse?customize=0')
    expect(consumeCustomizeFlag()).toBe(false)
  })
})

describe('every key exists in fa, af and en', () => {
  const KEYS = [
    'hubSections',
    'settings.title',
    'settings.description',
    'settings.menu',
    'settings.tabsTitle',
    'settings.chooseTabs',
  ]
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const pageLook = JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')).pageLook
    for (const key of KEYS) {
      const value = key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          pageLook,
        )
      expect(typeof value, `${lang}: pageLook.${key}`).toBe('string')
    }
  })
})
