// packages/ui/src/components/ui/accounting/components/DateRangePicker.tsx
'use client'

import { memo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { cn } from '../../../../lib/utils'
import { JalaliDatePicker } from '../../jalali-datepicker'

interface SingleDatePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export const SingleDatePicker = memo(function SingleDatePicker({
  value,
  onChange,
  label,
  className,
}: SingleDatePickerProps) {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <div className={cn('flex flex-col gap-1 md:gap-1.5', className)}>
      {label && (
        <label className="text-sm text-[hsl(var(--fg-secondary))] font-medium">{label}</label>
      )}
      <JalaliDatePicker
        value={value}
        onChange={onChange}
        locale={locale}
        placeholder={label || t('accounting.dateRange.date')}
        className="h-10 text-sm"
      />
    </div>
  )
})

interface DateRangePickerProps {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  className?: string
}

export const DateRangePicker = memo(function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  const t = useTranslations()

  return (
    <div className={cn('flex items-end gap-2 md:gap-3', className)}>
      <SingleDatePicker
        value={from}
        onChange={onFromChange}
        label={t('accounting.dateRange.from')}
      />
      <SingleDatePicker value={to} onChange={onToChange} label={t('accounting.dateRange.to')} />
    </div>
  )
})
