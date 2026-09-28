'use client'

// ============================================
// packages/ui/src/components/ui/developers/sandbox-panel.tsx
//
// A place to test an integration without touching the real books. Props only.
//
// The sandbox is its own, EMPTY workspace: keys, webhooks and OAuth
// installations made there reach only it. It is not a copy — copying real
// customers into a test space would put real people's data where test keys
// reach it.
// ============================================

import { memo } from 'react'
import type { SandboxStatus } from '@hisabche/api'
import { FlaskConical } from 'lucide-react'

import { Button } from '../button'
import { Card, CardContent } from '../card'
import type { SectionState } from './developers-view'

export interface SandboxPanelProps {
  t: (key: string, fallback?: string) => string
  state: SectionState
  status: SandboxStatus | null
  creating: boolean
  error: string | null
  onCreate: () => void
  onEnter: (id: string, name: string) => void
}

export const SandboxPanel = memo(function SandboxPanel(props: SandboxPanelProps) {
  const { t, status } = props
  const parent = status?.parent ?? null
  const own = status?.sandbox ?? null

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('sandbox.title')}
          </h2>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('sandbox.help')}</p>

        {props.state === 'loading' && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.loading')}</p>
        )}
        {props.state === 'not-configured' && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('sandbox.notConfigured')}</p>
        )}
        {props.state === 'forbidden' && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.forbidden')}</p>
        )}
        {props.state === 'error' && (
          <p className="text-sm text-[hsl(var(--color-destructive))]">{t('developer.loadError')}</p>
        )}

        {props.state === 'ready' && status && (
          <>
            {status.isSandbox ? (
              <div className="space-y-2">
                <p className="text-sm text-[hsl(var(--fg-primary))]">{t('sandbox.youAreIn')}</p>
                {parent ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => props.onEnter(parent.id, parent.name)}
                  >
                    {t('sandbox.back')}: {parent.name}
                  </Button>
                ) : (
                  <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('sandbox.noParent')}</p>
                )}
              </div>
            ) : own ? (
              <Button size="sm" onClick={() => props.onEnter(own.id, own.name)}>
                {t('sandbox.enter')}
              </Button>
            ) : (
              <Button size="sm" loading={props.creating} onClick={props.onCreate}>
                {t('sandbox.create')}
              </Button>
            )}
            {props.error && (
              <p className="text-sm text-[hsl(var(--color-destructive))]">{props.error}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
})

SandboxPanel.displayName = 'SandboxPanel'
