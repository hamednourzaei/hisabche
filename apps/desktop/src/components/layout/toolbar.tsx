// ============================================
// Toolbar — page title, sync indicator, quick actions.
// Doubles as the drag region on frameless macOS windows.
// ============================================

import React, { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CloudOff, Plus, RefreshCw, Search } from 'lucide-react'

import { Badge, Button } from '@/components/ui/primitives'
import { accelerator } from '@/shared/hooks/use-shortcuts'
import { useSyncStatus } from '@/features/sync/use-sync'
import { useUiStore } from '@/shared/stores/ui.store'
import { usePlatform } from '@/shared/hooks/use-platform'

export const Toolbar = memo(function Toolbar({ title }: { title: string }) {
  const { t } = useTranslation('desktop')
  const navigate = useNavigate()
  const platform = usePlatform()

  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const { pendingCount, isOffline, isSyncing, sync } = useSyncStatus()

  return (
    <header
      className="flex h-[var(--toolbar-height)] shrink-0 items-center gap-2 border-b border-[hsl(var(--border-default))] px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <h1 className="truncate text-sm font-bold">{title}</h1>

      <div className="flex-1" />

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {isOffline && (
          <Badge tone="warning">
            <CloudOff size={12} className="me-1" />
            {t('common.offline')}
          </Badge>
        )}

        {pendingCount > 0 && (
          <Button size="sm" variant="ghost" onClick={() => void sync()} disabled={isSyncing}>
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
            {t('sync.pending')} ({pendingCount})
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPaletteOpen(true)}
          title={accelerator('commandPalette', platform)}
        >
          <Search size={14} />
          {t('common.search')}
        </Button>

        <Button
          size="sm"
          variant="primary"
          onClick={() => navigate('/sales/new')}
          title={accelerator('newInvoice', platform)}
        >
          <Plus size={14} />
          {t('sales.newInvoice')}
        </Button>
      </div>
    </header>
  )
})
