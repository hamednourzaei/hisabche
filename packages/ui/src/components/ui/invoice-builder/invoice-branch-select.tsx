'use client'

// ============================================
// Which branch this invoice is written in.
//
// The server has always stored a branch on an invoice — and nothing in the
// form ever named one, so every invoice of a four-branch business belonged to
// «the business as a whole» and no list or report could be split by branch.
//
// ⚠️ THE CHOICE IS A REQUEST, NOT A PERMISSION. The server checks it against
// the member's own branches and refuses one they do not hold.
//
// Renders NOTHING for a business with no branches — most of them. «کل
// کسب‌وکار» stays a real answer: an invoice need not belong to a branch.
// ============================================

import { useEffect } from 'react'
import { asList, useBranches, type Branch } from '@hisabche/api'

import { SelectField } from '../select-field'

/** The select's value for «no branch». Never sent to the server. */
const WHOLE_BUSINESS = 'all'

export function InvoiceBranchSelect({
  t,
  value,
  onChange,
}: {
  t: (key: string, fallback?: string) => string
  value: string | null
  onChange: (id: string | null) => void
}) {
  const { data } = useBranches()
  const branches = asList<Branch>(data).filter((branch) => branch.isActive)

  // A remembered branch that was closed is not a choice any more.
  useEffect(() => {
    if (!data) return
    if (value && !branches.some((branch) => branch.id === value)) onChange(null)
  }, [value, data, branches, onChange])

  if (branches.length === 0) return null

  return (
    <div className="rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="invoice-branch" className="font-medium text-[hsl(var(--fg-primary))]">
          {t('invoiceBuilder.branch', 'شعبه')}
        </label>
        <div className="min-w-44">
          <SelectField
            id="invoice-branch"
            value={value ?? WHOLE_BUSINESS}
            onChange={(next) => onChange(next === WHOLE_BUSINESS ? null : next)}
            options={[
              { value: WHOLE_BUSINESS, label: t('invoiceBuilder.branchNone', 'کل کسب‌وکار') },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />
        </div>
      </div>
    </div>
  )
}
