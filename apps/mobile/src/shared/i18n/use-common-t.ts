// ============================================
// `useCommonT` — the shared catalog, in the signature shared code expects.
//
// `packages/ui` and `packages/ui-contract` are written against next-intl's
// `safeT` shape: `(key, fallback?) => string`. i18next's `t` takes its default
// through an options object instead, so a contract helper like
// `resolveExportColumns` cannot be handed `t` directly.
//
// This adapts the two, which keeps mobile calling the same contract helpers web
// does rather than growing a mobile-shaped copy of each one.
// ============================================

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { COMMON_NAMESPACE } from './index'

export type CommonT = (key: string, fallback?: string) => string

export function useCommonT(): CommonT {
  const { t } = useTranslation(COMMON_NAMESPACE)

  return useCallback(
    (key: string, fallback?: string) => t(key, { defaultValue: fallback ?? key }),
    [t],
  )
}
