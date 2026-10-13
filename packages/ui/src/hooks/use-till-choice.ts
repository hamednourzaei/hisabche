'use client'

// ============================================
// The till chosen for a cash payment — the state behind `TillSelectField`.
//
// Kept in a hook so the form that submits knows the SAME answer the field
// shows, with no effect copying one into the other:
//
//   · nobody has chosen yet  → the one till this money could go to, if there
//                              is exactly one; otherwise none
//   · the person chose       → that, for as long as it is still on the list
//                              («بدون صندوق» is a choice and is kept)
// ============================================

import { useMemo, useState } from 'react'
import { useOpenSessions } from '@hisabche/api'

import { keptTill, onlyTill, tillChoices, type TillChoice } from '../lib/till/till-choices'
import { useBookCurrency } from './use-book-currency'

export interface TillChoiceState {
  /** What to send: a till id, or '' for no till. */
  tillSessionId: string
  choices: TillChoice[]
  isLoading: boolean
  /** The list could not be read — not the same as «no tills». */
  failed: boolean
  retry: () => void
  pick: (tillSessionId: string) => void
}

export function useTillChoice(currency: string | undefined): TillChoiceState {
  const open = useOpenSessions()
  const bookCurrency = useBookCurrency()
  // null = the person has not chosen; '' = they chose «no till».
  const [picked, setPicked] = useState<string | null>(null)

  const choices = useMemo(
    () => tillChoices(open.data ?? [], currency, bookCurrency),
    [open.data, currency, bookCurrency],
  )

  return {
    tillSessionId: picked === null ? onlyTill(choices) : keptTill(choices, picked),
    choices,
    isLoading: open.isLoading,
    failed: Boolean(open.error),
    retry: () => void open.refetch(),
    pick: setPicked,
  }
}
