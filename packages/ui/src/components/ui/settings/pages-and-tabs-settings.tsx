'use client'

// ============================================
// Settings → «صفحه‌ها و تب‌ها» (owner's request, 7 Nov 2026).
//
// After Hisabche has shaped the workspace, the person adds or removes any page
// of the menu, and any tab of a page, for themselves.
//
// ⚠️ NO SECOND CUSTOMIZER. The menu row opens the same `PageCustomizer` with the
// same group as the header wrench (`useMenuCustomizerGroup`). A page's TABS are
// defined by the page itself (each hub registers them while it is open), so a
// «tabs» link goes to that page with `?customize=1` and its own wrench opens
// there — no copy of any hub's tab list lives here.
//
// It is the person's own view on this device (lib/page-look.ts): it changes
// nobody else's screen and nobody's access. A page the role does not include is
// not offered at all.
// ============================================

import { useTranslations } from 'next-intl'
import { isNavLocked } from '@hisabche/ui-contract'
import { useMyCapabilities } from '@hisabche/api'
import { NAV_ITEMS } from '../../../lib/menu/nav-items'
import { customizeHref } from '../../../lib/customize-flag'
import { useLocalePush } from '../../../hooks/use-locale-push'
import { PageCustomizer } from '../page-customizer'
import { useCustomizerT, useMenuCustomizerGroup } from '../global-page-customizer'

/**
 * Pages whose tabs can be chosen: each is a hub that registers its tabs with
 * the customizer (`PageHub lookId` or `usePageLook('hub:…')`). Guarded by
 * `pages-and-tabs-settings.test.ts`, which checks every path against its hub.
 */
export const PAGES_WITH_TABS: readonly string[] = [
  '/invoices',
  '/customers',
  '/warehouse',
  '/accounting',
  '/approvals',
  '/billing',
  '/data-and-sync',
]

export function PagesAndTabsSettings() {
  const t = useTranslations()
  const ct = useCustomizerT()
  const push = useLocalePush()
  const menuGroup = useMenuCustomizerGroup(ct)
  const blocked = useMyCapabilities().data?.blockedModules ?? []

  const pages = NAV_ITEMS.filter(
    (item) => PAGES_WITH_TABS.includes(item.path) && !isNavLocked(item.path, blocked),
  )

  return (
    <section
      data-pages-and-tabs=""
      className="space-y-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <div className="space-y-1">
        <h2 className="text-base font-bold text-[hsl(var(--fg-primary))]">
          {t('pageLook.settings.title')}
        </h2>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {t('pageLook.settings.description')}
        </p>
      </div>

      <PageCustomizer t={ct} groups={[menuGroup]} triggerLabel={t('pageLook.settings.menu')} />

      {pages.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
            {t('pageLook.settings.tabsTitle')}
          </h3>
          <ul className="divide-y divide-[hsl(var(--border-default))] rounded-xl border border-[hsl(var(--border-default))]">
            {pages.map((page) => (
              <li key={page.path}>
                <button
                  type="button"
                  onClick={() => push(customizeHref(page.path))}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start text-sm text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
                >
                  <span className="min-w-0 truncate">{t(page.labelKey as never)}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[hsl(var(--color-primary))]">
                    {t('pageLook.settings.chooseTabs')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
