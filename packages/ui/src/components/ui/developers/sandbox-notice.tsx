'use client'

// ============================================
// packages/ui/src/components/ui/developers/sandbox-notice.tsx
//
// «You are in a sandbox» — on every page of a sandbox workspace, in both
// shells (web dashboard-layout, desktop app-shell), like the subscription
// lock notice. Test invoices must never be mistaken for the real books, and
// the absence of a mark is not a mark (راهنمای سشن §۷٫۵).
//
// Renders nothing for a real workspace, and nothing while the answer is
// unknown or the feature is not set up (503): a real workspace can never be
// a sandbox before the migration exists.
// ============================================

import { FlaskConical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSandboxStatus } from '@hisabche/api'

import { enterWorkspace } from '../../../lib/enter-workspace'
import { Button } from '../button'

export function SandboxNotice() {
  const t = useTranslations()
  const { data } = useSandboxStatus()
  if (!data?.isSandbox) return null
  const parent = data.parent

  return (
    <div
      role="status"
      data-sandbox-notice=""
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.1)] px-4 py-2 text-sm text-[hsl(var(--fg-primary))]"
    >
      <FlaskConical
        className="size-4 shrink-0 text-[hsl(var(--color-warning))]"
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">{t('sandbox.notice')}</span>
      {parent && (
        <Button size="sm" variant="outline" onClick={() => enterWorkspace(parent.id, parent.name)}>
          {t('sandbox.back')}: {parent.name}
        </Button>
      )}
    </div>
  )
}
