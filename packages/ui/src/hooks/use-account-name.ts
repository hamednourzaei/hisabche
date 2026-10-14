'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'

import { accountName } from '../lib/accounting/account-name'
import { translateOr } from '../lib/translate-or'

/** An account's name as the reader should see it (see `lib/accounting/account-name.ts`). */
export function useAccountName(): (name: string) => string {
  const t = useTranslations()
  return useCallback(
    (name: string) => accountName(name, (key, fallback) => translateOr(t, key, fallback ?? key)),
    [t],
  )
}
