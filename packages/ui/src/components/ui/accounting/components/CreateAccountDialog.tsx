// packages/ui/src/components/ui/accounting/components/CreateAccountDialog.tsx
'use client'

import { SelectField } from '../../select-field'
import { memo, useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export interface CreateAccountInput {
  code: string
  name: string
  type: string
  parentId?: string
}

interface CreateAccountDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateAccountInput) => void
  isSubmitting: boolean
  parentOptions: { id: string; label: string }[]
}

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

export const CreateAccountDialog = memo(function CreateAccountDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  parentOptions,
}: CreateAccountDialogProps) {
  const t = useTranslations()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('asset')
  const [parentId, setParentId] = useState('')

  useEffect(() => {
    if (isOpen) {
      setCode('')
      setName('')
      setType('asset')
      setParentId('')
    }
  }, [isOpen])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!code.trim() || !name.trim()) return
      onSubmit({
        code: code.trim(),
        name: name.trim(),
        type,
        ...(parentId && { parentId }),
      })
    },
    [code, name, type, parentId, onSubmit],
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 md:p-4 bg-black/40"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-title"
        className={cn(
          'w-full max-w-sm md:max-w-md rounded-xl md:rounded-2xl',
          'bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))]',
          'shadow-2xl shadow-black/20 max-h-[90vh] overflow-y-auto',
        )}
      >
        <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-[hsl(var(--border-default))]">
          <h2
            id="create-account-title"
            className="text-sm md:text-base font-semibold text-[hsl(var(--fg-primary))]"
          >
            {t('accounting.accounts.createTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
            aria-label={t('action.close')}
          >
            <X className="size-4 md:size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-3 md:space-y-4">
          <div className="space-y-1 md:space-y-1.5">
            <label
              htmlFor="account-code"
              className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
            >
              {t('accounting.accounts.code')}
            </label>
            <input
              id="account-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              placeholder="1000"
            />
          </div>

          <div className="space-y-1 md:space-y-1.5">
            <label
              htmlFor="account-name"
              className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
            >
              {t('accounting.accounts.name')}
            </label>
            <input
              id="account-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
              placeholder={t('accounting.accounts.namePlaceholder')}
            />
          </div>

          <div className="space-y-1 md:space-y-1.5">
            <label
              htmlFor="account-type"
              className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
            >
              {t('accounting.accounts.type')}
            </label>
            <SelectField
              value={type}
              onChange={(value) => setType(value)}
              options={[
                ...ACCOUNT_TYPES.map((accType) => ({
                  value: accType,
                  label: t(`accounting.accountTypes.${accType}`),
                })),
              ]}
              className={
                'w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]'
              }
              id={'account-type'}
            />
          </div>

          {parentOptions.length > 0 && (
            <div className="space-y-1 md:space-y-1.5">
              <label
                htmlFor="account-parent"
                className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]"
              >
                {t('accounting.accounts.parent')}
              </label>
              <SelectField
                value={parentId}
                onChange={(value) => setParentId(value)}
                options={[
                  { value: '', label: t('accounting.accounts.noParent') },
                  ...parentOptions.map((opt) => ({ value: opt.id, label: opt.label })),
                ]}
                className={
                  'w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]'
                }
                id={'account-parent'}
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !code.trim() || !name.trim()}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium bg-[hsl(var(--color-primary))] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <Loader2 className="size-3.5 md:size-4 animate-spin" aria-hidden="true" />
              )}
              {t('action.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
})
