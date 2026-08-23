// ============================================
// Command palette — Ctrl/⌘+K.
//
// Commands come from the shared contract in `@hisabche/ui/menu`, so desktop and
// web offer the same verbs under the same words. Desktop adds one entry the web
// app has no equivalent for: syncing on demand, which is a local concern.
//
// Entries whose destination has no desktop screen are filtered out rather than
// shown and left dead.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslations } from 'next-intl'
import { Command } from 'cmdk'
import { COMMAND_ITEMS } from '@hisabche/ui/menu'

import { useUiStore } from '@/shared/stores/ui.store'
import { useSyncStatus } from '@/features/sync/use-sync'

interface Action {
  id: string
  label: string
  description: string
  icon: string
  run: () => void
}

/** Paths desktop mounts, matched on the segment before any query string. */
const DESKTOP_ROUTES = new Set([
  '/dashboard',
  '/invoices/new',
  '/invoices',
  '/warehouse',
  '/purchasing',
  '/accounting',
  '/customers',
  '/activities',
  '/sync-center',
  '/settings',
])

function toDesktopPath(path: string): string {
  const [pathname = '', query] = path.split('?')
  const mapped = pathname === '/dashboard' ? '/' : pathname
  return query ? `${mapped}?${query}` : mapped
}

function isSupported(path: string): boolean {
  return DESKTOP_ROUTES.has(path.split('?')[0] ?? '')
}

export function CommandPalette() {
  const t = useTranslations()
  const navigate = useNavigate()
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const { sync } = useSyncStatus()

  const close = useCallback(() => setOpen(false), [setOpen])

  const actions = useMemo<readonly Action[]>(() => {
    const shared = COMMAND_ITEMS.filter((item) => isSupported(item.path)).map((item) => ({
      id: item.id,
      label: t(item.labelKey),
      description: t(item.descriptionKey),
      icon: item.icon,
      run: () => navigate(toDesktopPath(item.path)),
    }))

    return [
      ...shared,
      {
        id: 'sync-now',
        label: t('sync.syncNow'),
        description: t('sync.syncNow_description'),
        icon: '🔄',
        run: () => void sync(),
      },
    ]
  }, [navigate, sync, t])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[var(--z-cmdk)] flex items-start justify-center bg-black/50 pt-32"
      onClick={close}
    >
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-lg">
        <Command
          label={t('commandPalette.title')}
          className="overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl"
        >
          <Command.Input
            autoFocus
            placeholder={t('commandPalette.searchPlaceholder')}
            className="h-11 w-full border-b border-[hsl(var(--border-default))] bg-transparent px-4 text-sm text-[hsl(var(--fg-primary))] outline-none placeholder:text-[hsl(var(--fg-tertiary))]"
          />

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {t('commandPalette.noResults')}
            </Command.Empty>

            {actions.map((action) => (
              <Command.Item
                key={action.id}
                // cmdk filters on `value`; include the description so searching
                // "خرید" finds "ثبت خرید" by either its label or its subtitle.
                value={`${action.label} ${action.description}`}
                onSelect={() => {
                  close()
                  action.run()
                }}
                className="flex min-h-9 cursor-pointer items-center gap-3 rounded-[var(--radius-xs)] px-3 py-1.5 text-sm text-[hsl(var(--fg-secondary))] data-[selected=true]:bg-[hsl(var(--surface-muted))] data-[selected=true]:text-[hsl(var(--fg-primary))]"
              >
                <span className="shrink-0 text-base">{action.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{action.label}</span>
                  <span className="block truncate text-xs text-[hsl(var(--fg-tertiary))]">
                    {action.description}
                  </span>
                </span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
