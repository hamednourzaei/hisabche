'use client'
// ============================================
// «فروشنده» on a sale (owner decision, 12 Nov 2026, V61 open decision 1).
//
// The seller is a MEMBER of the business — owner, manager, employee. The
// person issuing the invoice is the seller unless another member is chosen
// here; «me» sends nothing and the server stores nothing. The list is the
// business's members; the server proves the choice before it writes.
//
// Shown only when the business has more than one member — with one person
// there is nobody else to choose.
// ============================================
import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { asList, useWorkspaceMembers } from '@hisabche/api'
import { useAuthStore, useWorkspaceStore } from '@hisabche/store'

import { SelectField } from '../select-field'

interface MemberRow {
  user_id: string
  role: string
  full_name: string | null
  email?: string | null
}

export interface SellerChoice {
  /** '' = the issuer (nothing sent). */
  sellerUserId: string
  setSellerUserId: (value: string) => void
  options: Array<{ value: string; label: string }>
  /** False with one member: nothing to choose. */
  show: boolean
}

export function useSellerChoice(): SellerChoice {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId)
  const me = useAuthStore((state) => state.user?.id) ?? ''
  const members = useWorkspaceMembers(workspaceId ?? '')
  const [sellerUserId, setSellerUserId] = useState('')

  const options = useMemo(
    () =>
      asList<MemberRow>(members.data, 'workspace-members')
        .filter((m) => m.user_id && m.user_id !== me)
        .map((m) => ({ value: m.user_id, label: m.full_name || m.email || m.user_id.slice(0, 8) })),
    [members.data, me],
  )

  return { sellerUserId, setSellerUserId, options, show: options.length > 0 }
}

export function SellerSelectField({ choice }: { choice: SellerChoice }) {
  const t = useTranslations('invoiceBuilder.seller')
  return (
    <div className="space-y-1">
      <label htmlFor="invoice-seller" className="text-sm font-medium">
        {t('label')}
      </label>
      <SelectField
        id="invoice-seller"
        name="sellerUserId"
        data-field="sellerUserId"
        value={choice.sellerUserId}
        onChange={choice.setSellerUserId}
        options={[{ value: '', label: t('me') }, ...choice.options]}
      />
      <p className="text-xs text-[hsl(var(--fg-secondary))]">{t('hint')}</p>
    </div>
  )
}
