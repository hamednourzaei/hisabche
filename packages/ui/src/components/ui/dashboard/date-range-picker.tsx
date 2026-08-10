// packages/ui/src/components/ui/dashboard/date-range-picker.tsx
'use client'

import { cn } from '../../../lib/utils'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronLeft, X } from 'lucide-react'
import { toJalaali } from 'jalaali-js'
import { presetRange, type DateRange, type PresetKey } from '@hisabche/ui-contract'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select'
import { JalaliDatePicker } from '../jalali-datepicker'
import { useMediaQuery } from '../../../hooks/dashboard/use-media-query' // ✅ استفاده از hook

// The range types and the preset -> dates rule live in @hisabche/ui-contract,
// so the mobile dashboard resolves "7 days" to the same seven days this picker
// does. Re-exported here because existing call sites import them from this
// module.
export type { DateRange, PresetKey }

export type DateFormat = 'gregorian' | 'jalali'

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange, preset: PresetKey) => void
  t: (key: string, fallback?: string) => string
  disabled?: boolean
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PRESET_GROUPS = [
  {
    id: 'today-yesterday',
    labelKey: 'dateRange.group.todayYesterday',
    presets: [
      { key: 'today' as PresetKey, labelKey: 'dateRange.today' },
      { key: 'yesterday' as PresetKey, labelKey: 'dateRange.yesterday' },
    ],
  },
  {
    id: 'week-month',
    labelKey: 'dateRange.group.weekMonth',
    presets: [
      { key: '7days' as PresetKey, labelKey: 'dateRange.7days' },
      { key: '14days' as PresetKey, labelKey: 'dateRange.14days' },
      { key: '30days' as PresetKey, labelKey: 'dateRange.30days' },
    ],
  },
  {
    id: 'longer',
    labelKey: 'dateRange.group.longer',
    presets: [
      { key: '60days' as PresetKey, labelKey: 'dateRange.60days' },
      { key: '90days' as PresetKey, labelKey: 'dateRange.90days' },
    ],
  },
  {
    id: 'month-year',
    labelKey: 'dateRange.group.monthYear',
    presets: [
      { key: 'thisMonth' as PresetKey, labelKey: 'dateRange.thisMonth' },
      { key: 'lastMonth' as PresetKey, labelKey: 'dateRange.lastMonth' },
      { key: 'last3Months' as PresetKey, labelKey: 'dateRange.last3Months' },
      { key: 'last6Months' as PresetKey, labelKey: 'dateRange.last6Months' },
    ],
  },
  {
    id: 'yearly',
    labelKey: 'dateRange.group.yearly',
    presets: [
      { key: 'thisYear' as PresetKey, labelKey: 'dateRange.thisYear' },
      { key: 'lastYear' as PresetKey, labelKey: 'dateRange.lastYear' },
    ],
  },
]

// ─── Helper Functions ─────────────────────────────────────────────────────

// The preset -> dates rule lives in @hisabche/ui-contract so the mobile
// dashboard resolves "7 days" to the same seven days this picker does.
const getPresetRange = (preset: PresetKey): DateRange => presetRange(preset)

function formatDate(date: Date, format: DateFormat): string {
  if (format === 'jalali') {
    const j = toJalaali(date)
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`
  }
  return new Intl.DateTimeFormat('fa-AF', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function dateToString(date: Date | undefined): string {
  if (!date || isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function stringToDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? undefined : d
}

// ─── Focus Trap Hook ──────────────────────────────────────────────────────

function useFocusTrap(isOpen: boolean, containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!isOpen || !containerRef.current) return
    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const firstEl = focusableElements[0]
    const lastEl = focusableElements[focusableElements.length - 1]
    setTimeout(() => firstEl?.focus(), 100)
    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault()
          lastEl?.focus()
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault()
          firstEl?.focus()
        }
      }
    }
    container.addEventListener('keydown', handleTab)
    return () => container.removeEventListener('keydown', handleTab)
  }, [isOpen, containerRef])
}

// ─── Main Component ──────────────────────────────────────────────────────

export function DateRangePicker({ value, onChange, t, disabled = false }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activePreset, setActivePreset] = useState<PresetKey>('7days')
  const [dateFormat, setDateFormat] = useState<DateFormat>('jalali')
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined)
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>(() => ({
    0: true,
    1: true,
    2: false,
    3: false,
    4: false,
  }))

  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const selectRef = useRef<HTMLDivElement>(null)
  const isDesktop = useMediaQuery('(min-width: 640px)') // ✅ استفاده از hook

  useFocusTrap(isOpen, panelRef)

  const flatPresets = useMemo(() => PRESET_GROUPS.flatMap((g) => g.presets), [])

  const toggleGroup = useCallback((index: number) => {
    setOpenGroups((prev) => ({ ...prev, [index]: !prev[index] }))
  }, [])

  const handleSelectPreset = useCallback(
    (preset: PresetKey) => {
      const range = getPresetRange(preset)
      setActivePreset(preset)
      onChange(range, preset)
      setIsOpen(false)
    },
    [onChange],
  )

  const handleApplyCustom = useCallback(() => {
    if (!customFrom || !customTo) return
    let finalFrom = customFrom,
      finalTo = customTo
    if (finalFrom > finalTo) [finalFrom, finalTo] = [finalTo, finalFrom]
    setActivePreset('custom')
    onChange({ from: finalFrom, to: finalTo }, 'custom')
    setIsOpen(false)
  }, [customFrom, customTo, onChange])

  const handlePresetKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % flatPresets.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + flatPresets.length) % flatPresets.length)
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault()
        const targetPreset = flatPresets[focusedIndex]
        if (targetPreset) handleSelectPreset(targetPreset.key)
      }
    },
    [flatPresets, focusedIndex, handleSelectPreset],
  )

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current?.contains(target) ||
        selectRef.current?.contains(target) ||
        (target as HTMLElement).closest?.('[role="listbox"]')
      )
        return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen])

  const currentLabel =
    activePreset === 'custom'
      ? `${formatDate(value.from, dateFormat)} — ${formatDate(value.to, dateFormat)}`
      : t(`dateRange.${activePreset}`)

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={() => !disabled && setIsOpen((p) => !p)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 rounded-lg border text-xs sm:text-sm transition-all duration-150',
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-[hsl(var(--surface-muted))] active:bg-[hsl(var(--surface-elevated))]',
            'border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]',
            isOpen && 'bg-[hsl(var(--surface-muted))] border-[hsl(var(--color-primary)/0.3)]',
          )}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <CalendarDays
            className="size-3.5 sm:size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
            aria-hidden="true"
          />
          <span className="truncate max-w-[80px] sm:max-w-[140px] md:max-w-[180px]">
            {currentLabel}
          </span>
          <ChevronDown
            className={cn(
              'size-3 sm:size-3.5 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-150',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      <div aria-live="polite" className="sr-only">
        {currentLabel}
      </div>

      {isOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pb-4 sm:pb-0 p-3 sm:p-4 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('dateRange.selectPeriod')}
              className={cn(
                'relative z-10 w-full max-w-[440px] sm:max-w-[520px] rounded-2xl border p-3 sm:p-4 pt-10 sm:pt-12',
                'bg-[hsl(var(--surface-elevated)/0.99)] backdrop-blur-xl shadow-2xl shadow-black/30 border-[hsl(var(--border-default))]',
                'animate-in slide-in-from-bottom-4 sm:slide-in-from-top-2 duration-200 motion-reduce:animate-none',
              )}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-[hsl(var(--surface-muted))] transition-colors z-10"
                aria-label={t('common.close')}
              >
                <X className="size-4 text-[hsl(var(--fg-tertiary))]" />
              </button>

              <div ref={selectRef} className="absolute top-2.5 left-2.5 z-10">
                <Select
                  value={dateFormat}
                  dir="rtl"
                  onValueChange={(val) => setDateFormat(val as DateFormat)}
                >
                  <SelectTrigger
                    className="w-auto h-6 text-[9px] sm:text-[10px] font-medium border-[hsl(var(--border-default))] bg-transparent px-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                  >
                    <SelectItem value="jalali">🇮🇷 {t('dateRange.jalali')}</SelectItem>
                    <SelectItem value="gregorian">🌍 {t('dateRange.gregorian')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <h3 className="text-center text-sm sm:text-base font-semibold text-[hsl(var(--fg-primary))] mb-3">
                {t('dateRange.selectPeriod')}
              </h3>

              <div
                role="listbox"
                aria-label={t('dateRange.presetsAria')}
                onKeyDown={handlePresetKeyDown}
                className="outline-none space-y-1.5 sm:space-y-2.5"
              >
                {PRESET_GROUPS.map((group, i) => {
                  const isGroupOpen = openGroups[i] !== false
                  const hasActive = group.presets.some((p) => p.key === activePreset)
                  return (
                    <div
                      key={group.id}
                      className={cn(
                        'rounded-lg overflow-hidden transition-colors',
                        !isGroupOpen && 'mb-0.5 sm:mb-0',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(i)}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-1 text-[10px] sm:text-[11px] font-semibold',
                          'text-[hsl(var(--fg-tertiary))] hover:text-[hsl(var(--fg-secondary))] transition-colors',
                          hasActive && 'text-[hsl(var(--color-primary))]',
                          'sm:cursor-default sm:mb-1',
                        )}
                      >
                        <span>{t(group.labelKey)}</span>
                        <ChevronLeft
                          className={cn(
                            'size-3.5 sm:hidden transition-transform duration-200',
                            isGroupOpen ? 'rotate-90' : '-rotate-90',
                          )}
                        />
                      </button>

                      {(isGroupOpen || isDesktop) && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 sm:gap-1.5">
                          {group.presets.map((preset) => {
                            const globalIndex = flatPresets.findIndex((p) => p.key === preset.key)
                            return (
                              <button
                                key={preset.key}
                                type="button"
                                role="option"
                                aria-selected={activePreset === preset.key}
                                tabIndex={focusedIndex === globalIndex ? 0 : -1}
                                onClick={() => handleSelectPreset(preset.key)}
                                onFocus={() => setFocusedIndex(globalIndex)}
                                className={cn(
                                  'w-full px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-[11px] font-medium transition-colors outline-none truncate',
                                  activePreset === preset.key
                                    ? 'bg-[hsl(var(--color-primary))] text-white'
                                    : 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted)/0.6)]',
                                  focusedIndex === globalIndex &&
                                    'ring-2 ring-[hsl(var(--color-primary)/0.5)]',
                                )}
                              >
                                {t(preset.labelKey)}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="relative my-3 sm:my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[hsl(var(--border-default))]" />
                </div>
                <div className="relative flex justify-center text-[10px] sm:text-xs">
                  <span className="px-2 bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-tertiary))]">
                    {t('dateRange.custom')}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-[10px] sm:text-[11px] font-medium text-[hsl(var(--fg-tertiary))] mb-1">
                      {t('dateRange.from')}
                    </label>
                    <JalaliDatePicker
                      value={dateToString(customFrom)}
                      onChange={(str) => setCustomFrom(stringToDate(str))}
                      placeholder={t('dateRange.pickDate')}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-[11px] font-medium text-[hsl(var(--fg-tertiary))] mb-1">
                      {t('dateRange.to')}
                    </label>
                    <JalaliDatePicker
                      value={dateToString(customTo)}
                      onChange={(str) => setCustomTo(stringToDate(str))}
                      placeholder={t('dateRange.pickDate')}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleApplyCustom}
                    disabled={!customFrom || !customTo}
                    className={cn(
                      'flex-1 h-9 sm:h-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-150',
                      customFrom && customTo
                        ? 'bg-[hsl(var(--color-primary))] text-white hover:opacity-90 active:opacity-80'
                        : 'bg-[hsl(var(--surface-muted))] text-[hsl(var(--fg-tertiary))] cursor-not-allowed',
                    )}
                  >
                    {t('dateRange.apply')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomFrom(undefined)
                      setCustomTo(undefined)
                    }}
                    className="px-3 sm:px-4 h-9 sm:h-10 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
                  >
                    {t('common.clear')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
