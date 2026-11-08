'use client'

// ============================================
// Settings → «پروفایل کاری کسب‌وکار» (V54 5.8 — the business grows).
//
// The SAME adaptive questions the wizard asked (`OperatingQuestions`), saved as
// a NEW version of the workspace's Operational DNA through the one writer
// (`PUT /workspace/operational-profile` → `workspace_set_operational_dna`):
// the version read is named, so a change made meanwhile on another device is
// refused, never overwritten (`OPERATIONAL_PROFILE_CHANGED`).
//
// ⚠️ A NEW PROFILE CHANGES NOTHING ALREADY RECORDED. No role, no permission, no
// invoice, ledger row or stock movement is touched. It changes what is
// SUGGESTED: the starting menu is re-offered only to people who have no menu
// of their own (`useDnaMenuSuggestion`), and new defaults apply to new work.
//
// The server also requires `workspace.manage`; this screen follows it and
// says so instead of offering a button that would be refused.
// ============================================

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  apiErrorMessage,
  useMyCapabilities,
  useOperationalProfile,
  useSaveOnboardingProgress,
  useSaveOperationalDna,
  useWorkspaceProfile,
} from '@hisabche/api'
import {
  inferOperationalDna,
  operatingAnswersSchema,
  suggestedOperatingAnswers,
  type OperatingAnswers,
  type OperatingQuestion,
} from '@hisabche/validation'
import { Button } from '../button'
import { useToast } from '../toast-provider'
import { OperatingQuestions } from '../onboarding/operating-questions'

export function OperatingProfileSettings() {
  const t = useTranslations()
  const tr = (key: string, fallback?: string): string => {
    try {
      const value = t(key as never)
      return value === key ? (fallback ?? key) : value
    } catch {
      return fallback ?? key
    }
  }
  const toast = useToast()
  const operational = useOperationalProfile()
  const workspace = useWorkspaceProfile()
  const capabilities = useMyCapabilities()
  const saveDna = useSaveOperationalDna()
  const saveProgress = useSaveOnboardingProgress()

  const trade = workspace.data?.businessTypes[0]
  const stored = operational.data?.onboarding?.answers.operating
  // The answers last saved for this business, the trade's suggestion under them.
  const base = useMemo<OperatingAnswers>(
    () => ({ ...suggestedOperatingAnswers(trade), ...(stored ?? {}) }),
    [trade, stored],
  )
  const [edits, setEdits] = useState<OperatingAnswers>({})
  const answers = useMemo<OperatingAnswers>(() => ({ ...base, ...edits }), [base, edits])
  const [saving, setSaving] = useState(false)

  const mayEdit = capabilities.can('workspace.manage') === true
  const view = operational.data

  if (operational.isLoading) {
    return null
  }

  const onAnswer = (question: OperatingQuestion, answer: string) => {
    const next = operatingAnswersSchema.safeParse({ ...edits, [question]: answer })
    if (next.success) setEdits(next.data)
  }

  const save = async () => {
    if (!view) return
    setSaving(true)
    try {
      const dna = inferOperationalDna({ tradeKey: trade, ...answers })
      const saved = await saveDna(dna, view.version)
      if (saved === null) {
        toast.error(tr('settings.operatingProfile.notConfigured'))
        return
      }
      const previous = view.onboarding
      await saveProgress({
        state: 'ACTIVE',
        step: 0,
        answers: {
          businessType: previous?.answers.businessType ?? trade ?? null,
          storeSize: previous?.answers.storeSize ?? null,
          defaultCurrency: previous?.answers.defaultCurrency ?? null,
          operating: answers,
        },
      })
      setEdits({})
      await operational.refetch()
      toast.success(tr('settings.operatingProfile.saved'))
    } catch (error) {
      const message = apiErrorMessage(error, tr('settings.operatingProfile.failed'))
      if (message.includes('OPERATIONAL_PROFILE_CHANGED')) {
        toast.error(tr('settings.operatingProfile.changedElsewhere'))
        setEdits({})
        await operational.refetch()
      } else {
        toast.error(tr('settings.operatingProfile.failed'), message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      data-operating-profile=""
      className="space-y-4 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4"
    >
      <div className="space-y-1">
        <h2 className="text-base font-bold text-[hsl(var(--fg-primary))]">
          {tr('settings.operatingProfile.title')}
        </h2>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">
          {tr('settings.operatingProfile.description')}
        </p>
      </div>

      {operational.isError ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {tr('settings.operatingProfile.unread')}
        </p>
      ) : view && !view.configurable ? (
        <p role="note" className="text-sm text-[hsl(var(--fg-secondary))]">
          {tr('settings.operatingProfile.notConfigured')}
        </p>
      ) : (
        <>
          <OperatingQuestions answers={answers} onAnswer={onAnswer} t={tr} />
          {mayEdit ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                {tr('settings.operatingProfile.nothingRewritten')}
              </span>
              <Button
                onClick={() => void save()}
                disabled={saving || Object.keys(edits).length === 0}
              >
                {saving
                  ? tr('settings.operatingProfile.saving')
                  : tr('settings.operatingProfile.save')}
              </Button>
            </div>
          ) : (
            <p role="note" className="text-xs text-[hsl(var(--fg-tertiary))]">
              {tr('settings.operatingProfile.noAccess')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
