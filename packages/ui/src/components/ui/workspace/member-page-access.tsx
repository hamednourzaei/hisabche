'use client'

// ============================================
// The owner's per-person page access: one checkbox per module.
//
// Ticked = allowed. Saving replaces this person's blocks on the server, which
// enforces them on every request (backend restrictByModuleBlocks); their menu
// draws the unticked sections locked. Shown only to the owner, never for the
// owner — the server refuses both anyway.
// ============================================

import { memo, useEffect, useState } from 'react'
import { apiErrorMessage, useMemberBlocks, useSetMemberBlocks } from '@hisabche/api'

import { useToast } from '../toast-provider'

export const MemberPageAccess = memo(function MemberPageAccess({
  userId,
  t,
  onClose,
}: {
  userId: string
  t: (key: string) => string
  onClose: () => void
}) {
  const { data, isLoading, error } = useMemberBlocks()
  const save = useSetMemberBlocks()
  const toast = useToast()
  const [blocked, setBlocked] = useState<Set<string>>(new Set())

  // Start from what the server has for this person.
  const serverBlocks = data?.blocks[userId]
  useEffect(() => {
    setBlocked(new Set(serverBlocks ?? []))
  }, [serverBlocks])

  if (isLoading) {
    return <p className="p-3 text-xs text-[hsl(var(--fg-tertiary))]">…</p>
  }
  // An error is shown as one, never as an empty list of modules (§۷٫۳).
  if (error || !data) {
    return (
      <p role="alert" className="p-3 text-xs text-[hsl(var(--color-destructive))]">
        {apiErrorMessage(error, t('common.loadError'))}
      </p>
    )
  }

  const toggle = (key: string) =>
    setBlocked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const submit = async () => {
    try {
      await save.mutateAsync({ userId, modules: [...blocked] })
      toast.success(t('workspace.pageAccessSaved'))
      onClose()
    } catch (cause) {
      const message = apiErrorMessage(cause, t('common.saveError'))
      // The server's text is an English code for developers; the person sees
      // their own language.
      toast.error(
        message.includes('MEMBER_BLOCKS_NOT_CONFIGURED')
          ? t('workspace.pageAccessNotConfigured')
          : t('common.saveError'),
      )
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)] p-3">
      <p className="mb-2 text-xs text-[hsl(var(--fg-secondary))]">
        {t('workspace.pageAccessHint')}
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {data.modules.map((module) => (
          <label
            key={module.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            <input
              type="checkbox"
              name={`module-${module.key}`}
              checked={!blocked.has(module.key)}
              onChange={() => toggle(module.key)}
              className="size-4 accent-[hsl(var(--color-primary))]"
            />
            {/* Translated by key; the server label is Persian only. */}
            {t(`permissions.module.${module.key}`)}
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
        >
          {t('action.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={save.isPending}
          className="rounded-lg bg-[hsl(var(--color-primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--color-primary-fg))] disabled:opacity-60"
        >
          {t('action.save')}
        </button>
      </div>
    </div>
  )
})
