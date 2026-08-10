// ============================================
// Screen header for a navigation destination.
//
// Titles a screen from the navigation contract rather than from mobile-only
// copy, which is what stops a screen disagreeing with the entry the user just
// tapped. The audit found three of them doing exactly that: «موجودی» in the
// menu opened a screen headed «انبار», «خریدارها» opened «مشتریان», and
// «پول و سود» opened «حسابداری» — three destinations with two names each.
//
// The subtitle is the contract's description, the same second line the web
// PageHeader shows.
// ============================================

import React, { memo, type ReactNode } from 'react'
import { NAV_CONTRACT, type NavId } from '@hisabche/ui-contract'

import { useCommonT } from '../i18n/use-common-t'
import { ScreenHeader } from './screen-header'

export interface NavScreenHeaderProps {
  id: NavId
  /** Replaces the contract subtitle — for a screen that has something more useful to say. */
  subtitle?: string | undefined
  trailing?: ReactNode | undefined
}

export const NavScreenHeader = memo(function NavScreenHeader({
  id,
  subtitle,
  trailing,
}: NavScreenHeaderProps) {
  const t = useCommonT()
  const item = NAV_CONTRACT.find((entry) => entry.id === id)

  // A NavId with no contract entry is a programming error, not a runtime state;
  // rendering the id keeps the screen usable while making the mistake obvious.
  if (!item) return <ScreenHeader title={id} trailing={trailing} />

  return (
    <ScreenHeader
      title={t(item.labelKey)}
      subtitle={subtitle ?? t(item.descriptionKey)}
      trailing={trailing}
    />
  )
})
