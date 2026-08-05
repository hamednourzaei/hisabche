// ============================================
// Command palette — Ctrl/⌘+K. Navigation plus the actions the toolbar owns.
// ============================================

import React, { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Command } from 'cmdk'

import { useUiStore } from '@/shared/stores/ui.store'
import { useSyncStatus } from '@/features/sync/use-sync'

interface Action {
  id: string
  labelKey: string
  run: () => void
}

export function CommandPalette() {
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const { sync } = useSyncStatus()

  const close = useCallback(() => setOpen(false), [setOpen])

  const actions = useMemo<readonly Action[]>(
    () => [
      { id: 'dashboard', labelKey: 'nav.dashboard', run: () => navigate('/') },
      { id: 'sales', labelKey: 'nav.sales', run: () => navigate('/sales') },
      { id: 'new-invoice', labelKey: 'sales.newInvoice', run: () => navigate('/sales/new') },
      { id: 'inventory', labelKey: 'nav.inventory', run: () => navigate('/inventory') },
      { id: 'customers', labelKey: 'nav.customers', run: () => navigate('/customers') },
      { id: 'accounting', labelKey: 'nav.accounting', run: () => navigate('/accounting') },
      { id: 'sync', labelKey: 'sync.syncNow', run: () => void sync() },
      { id: 'settings', labelKey: 'nav.settings', run: () => navigate('/settings') },
    ],
    [navigate, sync]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[var(--z-cmdk)] flex items-start justify-center bg-black/50 pt-32"
      onClick={close}
    >
      <div onClick={(event) => event.stopPropagation()} className="w-full max-w-lg">
        <Command
          label={t('common.search')}
          className="overflow-hidden rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-2xl"
        >
          <Command.Input
            autoFocus
            placeholder={t('common.search')}
            className="h-11 w-full border-b border-[hsl(var(--border-default))] bg-transparent px-4 text-sm text-[hsl(var(--fg-primary))] outline-none placeholder:text-[hsl(var(--fg-tertiary))]"
          />

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="p-4 text-center text-sm text-[hsl(var(--fg-tertiary))]">
              {t('common.empty')}
            </Command.Empty>

            {actions.map((action) => (
              <Command.Item
                key={action.id}
                value={t(action.labelKey)}
                onSelect={() => {
                  close()
                  action.run()
                }}
                className="flex h-9 cursor-pointer items-center rounded-[var(--radius-xs)] px-3 text-sm text-[hsl(var(--fg-secondary))] data-[selected=true]:bg-[hsl(var(--surface-muted))] data-[selected=true]:text-[hsl(var(--fg-primary))]"
              >
                {t(action.labelKey)}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
